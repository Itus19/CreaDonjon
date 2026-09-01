import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { listPcEntityIdsForWorld } from "@/src/server/repos/campaigns";
import { listAllRevisionSnapshots } from "@/src/server/repos/entityRevisions";
import { normalizeStoredSnapshot } from "@/src/server/services/entityHistory";
import { zInventoryBlockData } from "@/src/core/schemas/blocks/inventory";
import { totalValueCp } from "@/src/core/rules/currency";
import { computeEconomyStats, type CurrencySnapshotDelta, type EconomyStats } from "@/src/core/rules/economyStats";

type TypedClient = SupabaseClient<Database>;

/** Valeur du porte-monnaie (bloc `inventory`) d'un instantane, `null` si l'entite n'avait pas encore ce bloc a cette revision (jamais traite comme un porte-monnaie vide : ca creerait un faux "gain" a l'apparition du bloc). */
function inventoryValueCp(snapshotJson: unknown): number | null {
  const snapshot = normalizeStoredSnapshot(snapshotJson as never);
  const block = snapshot.blocks.find((b) => b.blockType === "inventory");
  if (!block) return null;
  const parsed = zInventoryBlockData.safeParse(block.data);
  if (!parsed.success) return null;
  return totalValueCp(parsed.data.currency);
}

/** Retour utilisateur (V2-M12) : "argent dépensé, argent gagné" — diffe la valeur du porte-monnaie entre chaque paire de revisions consecutives de chaque PJ de la campagne, meme source (`entity_revisions`) que le journal d'activite (`activityJournal.ts`), mais agrege sur TOUTE l'histoire plutot qu'une fenetre de journal. */
export async function getCampaignEconomyStats(supabase: TypedClient, params: { worldId: string }): Promise<EconomyStats> {
  const pcEntityIds = await listPcEntityIdsForWorld(supabase, params.worldId);
  const deltas: CurrencySnapshotDelta[] = [];

  await Promise.all(
    pcEntityIds.map(async (entityId) => {
      const snapshots = await listAllRevisionSnapshots(supabase, entityId);
      let previousCp: number | null = null;
      for (const row of snapshots) {
        const currentCp = inventoryValueCp(row.snapshot);
        if (currentCp !== null && previousCp !== null) {
          deltas.push({ beforeCp: previousCp, afterCp: currentCp });
        }
        if (currentCp !== null) previousCp = currentCp;
      }
    })
  );

  return computeEconomyStats(deltas);
}
