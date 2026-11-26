import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import type { PartOfEdge } from "@/src/core/entity-tree/build-tree";
import { zInfoboxBlockData } from "@/src/core/schemas/blocks/infobox";
import { zSettlementBlockData } from "@/src/core/schemas/blocks/settlement";
import { placeTypeOf, settlementOf, type PlaceFacts } from "@/src/core/worldgen/placePresence";
import type { OccupantPlaceType, WikiWorker } from "@/src/core/worldgen/occupants";
import type { SettlementBlockData } from "@/src/core/schemas/blocks/settlement";
import { placeChain } from "@/src/server/services/sceneGeneration";
import { listBlocksByTypesForEntities } from "@/src/server/repos/blocks";
import { listEntitiesByIds } from "@/src/server/repos/entities";
import { listWorksAtForPlace } from "@/src/server/repos/relations";

type TypedClient = SupabaseClient<Database>;

/**
 * V3.2-31 — Ce qu'il faut lire du wiki pour faire vivre un lieu
 * (`src/core/rules/sceneLife.ts`) : son type, sa ville en agrégat, les PNJ
 * qui y travaillent. Lu une fois, quand la scène change de lieu (trois
 * lectures en parallèle) ; ensuite la présence se recalcule à chaque heure
 * sans aucune requête (`docs/QUOTAS.md`).
 *
 * `null` quand rien ne dit ce qu'est le lieu (ni l'entrée « Type » de son
 * infobox, ni son nom) : la présence reste celle posée à la main.
 */
export async function lireLaVieDuLieu(
  supabase: TypedClient,
  params: { worldId: string; locationId: string; edges: PartOfEdge[] }
): Promise<{ placeType: OccupantPlaceType; settlement: SettlementBlockData; workers: WikiWorker[] } | null> {
  const chain = placeChain(params.locationId, params.edges);
  const [entities, blocks, workerIds] = await Promise.all([
    listEntitiesByIds(supabase, [params.locationId]),
    listBlocksByTypesForEntities(supabase, chain, ["infobox", "settlement"]),
    listWorksAtForPlace(supabase, params.worldId, params.locationId),
  ]);
  const sorted = [...blocks].sort((a, b) => a.display_order - b.display_order);
  const facts: PlaceFacts[] = chain.map((id) => {
    const mine = sorted.filter((b) => b.entity_id === id);
    const entries = mine.flatMap((b) => {
      if (b.block_type !== "infobox") return [];
      const parsed = zInfoboxBlockData.safeParse(b.data);
      return parsed.success ? parsed.data.entries : [];
    });
    const settlementBlock = mine.find((b) => b.block_type === "settlement");
    const parsedSettlement = settlementBlock ? zSettlementBlockData.safeParse(settlementBlock.data) : null;
    return { id, entries, settlement: parsedSettlement?.success ? parsedSettlement.data : null };
  });

  const name = entities[0]?.name ?? "";
  const placeType = placeTypeOf(name, facts[0]?.entries ?? []);
  const settlement = settlementOf(facts);
  if (!placeType || !settlement) return null;
  return { placeType, settlement, workers: workerIds.map((entityId) => ({ entityId })) };
}
