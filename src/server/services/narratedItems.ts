import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import { itemFromNarration } from "@/src/core/rules/narratedItem";
import { zInventoryBlockData } from "@/src/core/schemas/blocks/inventory";
import { listBlocksByTypesForEntities } from "@/src/server/repos/blocks";
import { insertAiProposal } from "@/src/server/repos/aiProposals";
import { updateBlockContent } from "@/src/server/services/blocks";
import { revealFacets } from "@/src/server/services/facetDiscoveries";
import { isWorldAdmin } from "@/src/server/services/permissions";

type TypedClient = SupabaseClient<Database>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type AddNarratedItemOutcome = { ok: true; itemId: string } | { ok: false; reason: "forbidden" | "no_inventory" | "refused" | "conflict" };

/**
 * V3.2-54 — Un objet ordinaire que la narration a montré chez un PNJ
 * (`npc_item`) entre dans son inventaire, si le moteur l'accepte
 * (`itemFromNarration` : pas de doublon, jamais une arme, une armure ni un
 * objet caché). Il est découvert pour toute la table, comme ce que le PNJ
 * porte (V3.2-48).
 *
 * Règle 9 : une ligne `ai_proposals` `update_block`, appliquée d'office
 * (ADR 0114). Réservé au MJ du monde, seul à écrire le bloc `gm`. Une
 * esquisse (pas encore de fiche) n'a pas d'inventaire : rien à faire.
 *
 * Coût : une lecture du bloc, une écriture, une facette au plus.
 */
export async function addNarratedItem(
  supabase: TypedClient,
  params: { worldId: string; campaignId: string; sessionEventId: string; entityId: string; name: string; callerId: string }
): Promise<AddNarratedItemOutcome> {
  // Une esquisse ou une personne calculée n'a pas encore de fiche : son identifiant n'est pas celui d'une entité.
  if (!UUID.test(params.entityId)) return { ok: false, reason: "no_inventory" };
  if (!(await isWorldAdmin(supabase, { worldId: params.worldId, userId: params.callerId }))) return { ok: false, reason: "forbidden" };
  const [block] = await listBlocksByTypesForEntities(supabase, [params.entityId], ["inventory"]);
  const parsed = block ? zInventoryBlockData.safeParse(block.data) : null;
  if (!block || !parsed?.success) return { ok: false, reason: "no_inventory" };

  const item = itemFromNarration({ name: params.name }, parsed.data);
  if (!item) return { ok: false, reason: "refused" };

  const saved = await updateBlockContent(supabase, {
    id: block.id,
    expectedVersion: block.version,
    display: block.display,
    data: { ...parsed.data, items: [...parsed.data.items, item] },
    visibilityLevel: block.visibility_level,
    visibilityScopeId: block.visibility_scope_id,
    changedBy: params.callerId,
    changeSource: "ai",
  });
  if (!saved.ok) return { ok: false, reason: saved.reason === "forbidden" ? "forbidden" : "conflict" };

  await insertAiProposal(supabase, {
    worldId: params.worldId,
    campaignId: params.campaignId,
    sessionEventId: params.sessionEventId,
    kind: "update_block",
    targetEntityId: params.entityId,
    payload: { blockId: block.id, npc_item: { name: params.name }, item } as unknown as Json,
    status: "applied",
    autoApplied: true,
    appliedAt: new Date().toISOString(),
  });
  // Le personnage vient de le voir : découvert pour toute la table.
  await revealFacets(supabase, { campaignId: params.campaignId, entityId: params.entityId, facets: [`item:${item.id}`], userId: null, sourceEventId: params.sessionEventId });
  return { ok: true, itemId: item.id };
}
