import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/src/types/database";
import { gesteDeDissimulation } from "@/src/core/rules/pcConcealment";
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
const INDICE = /cach|dissimul|escamot|sors|sort|montr|devoil|dévoil|degain|dégain|brandi|exhib/i;

/**
 * V3.2-80 (ADR 0122, point 3) — Après le tour du personnage : un jet de
 * Discrétion ou d'Escamotage réussi qui nomme un objet du sac le cache, avec
 * le total pour DD secret ; « je sors la lettre » le remet en vue. Rend la
 * phrase de fait établi pour la narration, ou rien.
 *
 * Coût (docs/QUOTAS.md) : rien si la phrase n'a aucun mot de dissimulation ;
 * sinon l'inventaire et les noms de ses objets, et une écriture s'il y a un geste.
 */
export async function applyPcConcealment(
  supabase: TypedClient,
  params: { world: { id: string; slug: string }; locale: Locale; pcEntityId: string; callerId: string; text: string; detail: unknown }
): Promise<string | null> {
  if (!INDICE.test(params.text)) return null;
  const tour = zTurn.safeParse(params.detail);
  if (!tour.success) return null;
  const sac = await readInventorySnapshot(supabase, params.pcEntityId);
  if (!sac || sac.items.length === 0) return null;
  const noms = await nameInventoryItems(supabase, {
    world: params.world,
    locale: params.locale,
    items: sac.items.map((i) => ({ id: i.id, qty: i.qty, ...("ref" in i ? { ref: i.ref } : { label: i.label }) })),
  });
  const items = noms.map((n) => ({ id: n.id, name: n.name, concealed: sac.items.find((i) => i.id === n.id)?.concealed === true }));
  const geste = gesteDeDissimulation({
    intent: { kind: tour.data.intent.kind, actionId: tour.data.intent.action_id ?? null },
    check: tour.data.check ?? null,
    text: params.text,
    items,
  });
  if (!geste) return null;

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
