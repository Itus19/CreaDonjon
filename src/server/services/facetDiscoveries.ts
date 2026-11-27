import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { insertFacetDiscoveries, listFacetDiscoveries } from "@/src/server/repos/entityFacetDiscoveries";
import { listBlocksByTypesForEntities } from "@/src/server/repos/blocks";
import { isFacetKey, playerViewOfInventory, playerViewOfStatblock, type PlayerInventoryView, type PlayerStatblockView } from "@/src/core/rules/facets";
import { zStatblockBlockData } from "@/src/core/schemas/blocks/statblock";
import { zInventoryBlockData } from "@/src/core/schemas/blocks/inventory";

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
