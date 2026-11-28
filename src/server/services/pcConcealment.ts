import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/src/types/database";
import { gesteDeDissimulation } from "@/src/core/rules/pcConcealment";
import { segmentPlainText } from "@/src/core/rules/concealedMarks";
import { zTextBlockData } from "@/src/core/schemas/blocks/text";
import type { Json } from "@/src/types/database";
import { getBlockById, listBlocksByTypesForEntities } from "@/src/server/repos/blocks";
import { insertSessionEvent, nextEventSeq } from "@/src/server/repos/sessions";
import type { Segment } from "@/src/core/schemas/entities/segments";
import { updateBlockContent } from "@/src/server/services/blocks";
import { nameInventoryItems } from "@/src/server/services/facetDiscoveries";
import { readInventorySnapshot, setItemConcealment } from "@/src/server/services/inventoryActions";
import type { Locale } from "@/src/i18n/request";

type TypedClient = SupabaseClient<Database>;

/** Ce qu'il faut lire du tour joué : la sorte d'intention, la compétence, le total et le verdict. */
const zTurn = z.object({
  intent: z.object({ kind: z.string(), action_id: z.string().nullable().optional() }),
  check: z.object({ total: z.number(), verdict: z.enum(["success", "fail"]).nullable() }).nullable().optional(),
});

/** La source du journal d'un paragraphe caché ou révélé (V3.2-83). */
export const PC_CONCEALMENT_SOURCE = "pc_concealment";

/** Ce paragraphe, dissimulé avec cette difficulté, ou en vue (`null`) ; les autres inchangés. */
function avecDissimulation(segments: readonly Segment[], segmentId: string, concealed: { dc: number } | null): Segment[] {
  return segments.map((seg) => {
    if (seg.id !== segmentId) return seg;
    const reste = { ...seg };
    delete reste.concealed;
    return concealed ? { ...reste, concealed } : reste;
  });
}

/** Les mots qui peuvent annoncer un geste de dissimulation : sans eux, aucune lecture de plus. */
const INDICE = /cach|dissimul|escamot|sors|sort|montr|devoil|dévoil|degain|dégain|brandi|exhib|enlev|enlèv|retir|decouvr|découvr/i;

/**
 * V3.2-80 (ADR 0122, point 3) — Après le tour du personnage : un jet de
 * Discrétion ou d'Escamotage réussi qui nomme un objet du sac le cache, avec
 * le total pour DD secret ; « je sors la lettre » le remet en vue. Rend la
 * phrase de fait établi pour la narration, ou rien.
 *
 * V3.2-81 : un paragraphe de sa description (« je cache mon tatouage sous un
 * bandage ») se dissimule de même, si aucun objet du sac n'est nommé.
 *
 * Coût (docs/QUOTAS.md) : rien si la phrase n'a aucun mot de dissimulation ;
 * sinon l'inventaire, les blocs texte et les noms des objets, et une écriture
 * s'il y a un geste.
 */
export async function applyPcConcealment(
  supabase: TypedClient,
  params: {
    world: { id: string; slug: string };
    locale: Locale;
    pcEntityId: string;
    callerId: string;
    text: string;
    detail: unknown;
    /** V3.2-83 : la séance du tour, pour journaliser un paragraphe caché ou révélé, que « Annuler ce tour » remettra. */
    sessionId: string | null;
  }
): Promise<string | null> {
  if (!INDICE.test(params.text)) return null;
  const tour = zTurn.safeParse(params.detail);
  if (!tour.success) return null;
  const [sac, textes] = await Promise.all([
    readInventorySnapshot(supabase, params.pcEntityId),
    listBlocksByTypesForEntities(supabase, [params.pcEntityId], ["text"]),
  ]);
  const noms =
    sac && sac.items.length > 0
      ? await nameInventoryItems(supabase, {
          world: params.world,
          locale: params.locale,
          items: sac.items.map((i) => ({ id: i.id, qty: i.qty, ...("ref" in i ? { ref: i.ref } : { label: i.label }) })),
        })
      : [];
  const items = noms.map((n) => ({ id: n.id, name: n.name, concealed: sac?.items.find((i) => i.id === n.id)?.concealed === true }));
  // V3.2-81 : les paragraphes de sa description, pour un signe distinctif (un tatouage sous un bandage).
  const blocsTexte = textes.flatMap((row) => {
    const lu = zTextBlockData.safeParse(row.data);
    return lu.success ? [{ row, data: lu.data }] : [];
  });
  const signes = blocsTexte.flatMap(({ data }) =>
    data.segments.filter((seg) => seg.blockType === "paragraph").map((seg) => ({ id: seg.id, text: segmentPlainText(seg), concealed: seg.concealed !== undefined }))
  );
  const geste = gesteDeDissimulation({
    intent: { kind: tour.data.intent.kind, actionId: tour.data.intent.action_id ?? null },
    check: tour.data.check ?? null,
    text: params.text,
    items,
    signes,
  });
  if (!geste) return null;

  if ("markId" in geste) {
    const bloc = blocsTexte.find(({ data }) => data.segments.some((seg) => seg.id === geste.markId));
    if (!bloc) return null;
    const avant = bloc.data.segments.find((seg) => seg.id === geste.markId)?.concealed ?? null;
    const segments = avecDissimulation(bloc.data.segments, geste.markId, geste.concealed ? { dc: geste.concealDc } : null);
    const saved = await updateBlockContent(supabase, {
      id: bloc.row.id,
      expectedVersion: bloc.row.version,
      display: bloc.row.display,
      data: { ...bloc.data, segments },
      visibilityLevel: bloc.row.visibility_level,
      visibilityScopeId: bloc.row.visibility_scope_id,
      changedBy: params.callerId,
    });
    if (!saved.ok) {
      console.warn(`Signe distinctif non caché (${saved.reason})`);
      return null;
    }
    const texte = signes.find((m) => m.id === geste.markId)?.text ?? "ce signe";
    if (params.sessionId) {
      // V3.2-83 : l'annulation du tour relit cet événement pour remettre le paragraphe comme il était.
      await insertSessionEvent(supabase, {
        sessionId: params.sessionId,
        seq: await nextEventSeq(supabase, params.sessionId),
        kind: "rule_application",
        actor: "system",
        actorUserId: null,
        payload: {
          __v: 1,
          source: PC_CONCEALMENT_SOURCE,
          entity_id: params.pcEntityId,
          block_id: bloc.row.id,
          segment_id: geste.markId,
          before: avant,
          changes_text: [geste.concealed ? "Signe distinctif dissimulé" : "Signe distinctif de nouveau visible"],
          hints_text: [],
          ignored_text: [],
        } as unknown as Json,
      });
    }
    return geste.concealed
      ? `Le personnage a dissimulé ce signe distinctif : « ${texte} ». Seul un regard attentif ou une fouille pourra le trouver.`
      : `Ce signe distinctif est de nouveau visible : « ${texte} ».`;
  }

  const ecrit = await setItemConcealment(supabase, {
    entityId: params.pcEntityId,
    itemId: geste.itemId,
    concealed: geste.concealed,
    ...(geste.concealed ? { concealDc: geste.concealDc } : {}),
    actorUserId: params.callerId,
  });
  if ("error" in ecrit) {
    console.warn(`Objet du personnage non caché (${ecrit.error})`);
    return null;
  }
  const nom = items.find((i) => i.id === geste.itemId)?.name ?? "l'objet";
  return geste.concealed
    ? `Le personnage a caché ${nom} : seule une fouille ou un regard attentif pourra le trouver.`
    : `${nom} n'est plus caché : on peut le voir.`;
}

const zConcealmentEvent = z.object({
  source: z.literal(PC_CONCEALMENT_SOURCE),
  block_id: z.string().uuid(),
  segment_id: z.string().min(1),
  before: z.object({ dc: z.number().int() }).nullable(),
});

/**
 * V3.2-83 — « Annuler ce tour » : le paragraphe que le tour a caché ou révélé
 * revient comme il était. Lit les événements du tour, du dernier au premier.
 * Rend le nombre de paragraphes remis.
 *
 * Coût (docs/QUOTAS.md) : rien sans geste dans le tour ; sinon une lecture et
 * une écriture par paragraphe.
 */
export async function restorePcConcealments(supabase: TypedClient, params: { payloads: readonly unknown[]; callerId: string }): Promise<number> {
  let remis = 0;
  for (const payload of [...params.payloads].reverse()) {
    const lu = zConcealmentEvent.safeParse(payload);
    if (!lu.success) continue;
    const row = await getBlockById(supabase, lu.data.block_id);
    const data = row ? zTextBlockData.safeParse(row.data) : null;
    if (!row || !data?.success) continue;
    const saved = await updateBlockContent(supabase, {
      id: row.id,
      expectedVersion: row.version,
      display: row.display,
      data: { ...data.data, segments: avecDissimulation(data.data.segments, lu.data.segment_id, lu.data.before) },
      visibilityLevel: row.visibility_level,
      visibilityScopeId: row.visibility_scope_id,
      changedBy: params.callerId,
    });
    if (saved.ok) remis += 1;
    else console.error("Signe distinctif non remis", lu.data.segment_id, saved.reason);
  }
  return remis;
}
