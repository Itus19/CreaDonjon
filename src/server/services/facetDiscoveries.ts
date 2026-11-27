import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { insertFacetDiscoveries, listFacetDiscoveries } from "@/src/server/repos/entityFacetDiscoveries";
import { listBlocksByTypesForEntities } from "@/src/server/repos/blocks";
import { isFacetKey, playerViewOfInventory, playerViewOfStatblock, type PlayerInventoryView, type PlayerStatblockView } from "@/src/core/rules/facets";
import { zStatblockBlockData } from "@/src/core/schemas/blocks/statblock";
import { zInventoryBlockData } from "@/src/core/schemas/blocks/inventory";
import { resolveBlockReferences } from "@/src/server/services/referenceChips";
import { getWorldDefaultRulesetId } from "@/src/server/repos/worlds";
import { formatCpFr } from "@/src/i18n/fr";
import type { Locale } from "@/src/i18n/request";

type TypedClient = SupabaseClient<Database>;

/**
 * V3.2-49 (ADR 0118) — Révèle des facettes d'un PNJ dans une partie : n'écrit
 * que celles qui ne le sont pas déjà, refuse une facette mal formée. Rend
 * celles qui sont nouvelles, pour que le récit puisse les dire.
 */
export async function revealFacets(
  supabase: TypedClient,
  params: { campaignId: string; entityId: string; facets: string[]; userId?: string | null; sourceEventId?: string | null }
): Promise<{ revealed: string[] }> {
  const wanted = [...new Set(params.facets)];
  const invalid = wanted.filter((f) => !isFacetKey(f));
  if (invalid.length > 0) throw new Error(`Facettes invalides : ${invalid.join(", ")}`);
  const userId = params.userId ?? null;
  const known = (await listFacetDiscoveries(supabase, { campaignId: params.campaignId, entityIds: [params.entityId], userId })).get(params.entityId) ?? new Set<string>();
  const fresh = wanted.filter((f) => !known.has(f));
  await insertFacetDiscoveries(
    supabase,
    fresh.map((facet) => ({ campaignId: params.campaignId, entityId: params.entityId, facet, userId, sourceEventId: params.sourceEventId ?? null }))
  );
  return { revealed: fresh };
}

export interface NpcPlayerView {
  sheet: PlayerStatblockView | null;
  gear: PlayerInventoryView | null;
}

/**
 * V3.2-49 — Ce que la personne qui joue sait de ces PNJ, construit côté
 * serveur à partir des blocs `statblock` et `inventory` et des facettes
 * découvertes. Seule cette vue part vers l'écran, jamais les blocs.
 *
 * Le client doit pouvoir lire les blocs `gm` : c'est le cas en solo (la
 * personne qui joue est propriétaire du monde). En partie à table, une
 * joueuse ne les lit pas ; il faudra une fonction `security definer` qui
 * rende la vue filtrée (chantier du jeu à distance, ADR 0118).
 *
 * Coût : deux lectures groupées (blocs, facettes), quel que soit le nombre de PNJ.
 */
export async function readNpcPlayerViews(
  supabase: TypedClient,
  params: { campaignId: string; entityIds: string[]; userId: string | null }
): Promise<Map<string, NpcPlayerView>> {
  const [blocks, facets] = await Promise.all([
    listBlocksByTypesForEntities(supabase, params.entityIds, ["statblock", "inventory"]),
    listFacetDiscoveries(supabase, params),
  ]);
  const views = new Map<string, NpcPlayerView>();
  for (const id of params.entityIds) {
    const known = facets.get(id) ?? new Set<string>();
    const sheetBlock = blocks.find((b) => b.entity_id === id && b.block_type === "statblock");
    const gearBlock = blocks.find((b) => b.entity_id === id && b.block_type === "inventory");
    const sheet = sheetBlock ? zStatblockBlockData.safeParse(sheetBlock.data) : null;
    const gear = gearBlock ? zInventoryBlockData.safeParse(gearBlock.data) : null;
    views.set(id, {
      sheet: sheet?.success ? playerViewOfStatblock(sheet.data, known) : null,
      gear: gear?.success ? playerViewOfInventory(gear.data, known) : null,
    });
  }
  return views;
}

/** Ce que l'écran du wiki affiche d'un PNJ : seulement ce qui est découvert, avec des noms lisibles. */
export interface NpcDisplayView {
  abilities: PlayerStatblockView["abilities"];
  ac?: number;
  hp?: number;
  speed?: string;
  actions: { name: string; text: string }[];
  traits: { name: string; text: string }[];
  items: { id: string; name: string; qty: number }[];
  /** La bourse, en pièces courantes (« 3 po 4 pa »), si elle est découverte. */
  purse?: string;
  hasSheet: boolean;
  hasGear: boolean;
}

/**
 * V3.2-51 — La vue d'UN PNJ pour la page du wiki solo, avec le nom français
 * des objets de règle. `null` quand le PNJ n'a ni fiche allégée ni équipement.
 *
 * Coût : les deux lectures de `readNpcPlayerViews`, et une résolution groupée
 * des noms d'objets seulement s'il y a des objets découverts.
 */
export async function readNpcDisplayView(
  supabase: TypedClient,
  params: { campaignId: string; entityId: string; userId: string; world: { id: string; slug: string }; locale: Locale }
): Promise<NpcDisplayView | null> {
  const view = (await readNpcPlayerViews(supabase, { campaignId: params.campaignId, entityIds: [params.entityId], userId: params.userId })).get(params.entityId);
  if (!view || (!view.sheet && !view.gear)) return null;

  const items = view.gear?.items ?? [];
  const refs = items.flatMap((i) => ("ref" in i ? [i.ref] : []));
  const chips = refs.length > 0 ? await resolveBlockReferences(supabase, params.world, await getWorldDefaultRulesetId(supabase, params.world.id), params.locale, refs) : [];
  let chipIndex = 0;
  const named = items.map((i) => {
    if (!("ref" in i)) return { id: i.id, name: i.label, qty: i.qty };
    const chip = chips[chipIndex++];
    return { id: i.id, name: chip?.name ?? (i.ref.kind === "rule" ? i.ref.key : "objet"), qty: i.qty };
  });

  const currency = view.gear?.currency;
  return {
    abilities: view.sheet?.abilities ?? {},
    ...(view.sheet?.ac !== undefined ? { ac: view.sheet.ac } : {}),
    ...(view.sheet?.hp !== undefined ? { hp: view.sheet.hp } : {}),
    ...(view.sheet?.speed !== undefined ? { speed: view.sheet.speed } : {}),
    actions: view.sheet?.actions ?? [],
    traits: view.sheet?.traits ?? [],
    items: named,
    ...(currency ? { purse: formatCpFr(currency.pp * 1000 + currency.gp * 100 + currency.ep * 50 + currency.sp * 10 + currency.cp) } : {}),
    hasSheet: view.sheet !== null,
    hasGear: view.gear !== null,
  };
}
