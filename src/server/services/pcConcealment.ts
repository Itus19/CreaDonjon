import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/src/types/database";
import { gesteDeDissimulation } from "@/src/core/rules/pcConcealment";
import { segmentPlainText } from "@/src/core/rules/concealedMarks";
import { zTextBlockData } from "@/src/core/schemas/blocks/text";
import { listBlocksByTypesForEntities } from "@/src/server/repos/blocks";
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
  params: { world: { id: string; slug: string }; locale: Locale; pcEntityId: string; callerId: string; text: string; detail: unknown }
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
    const segments = bloc.data.segments.map((seg) => {
      if (seg.id !== geste.markId) return seg;
      const reste = { ...seg };
      delete reste.concealed;
      return geste.concealed ? { ...reste, concealed: { dc: geste.concealDc } } : reste;
    });
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
