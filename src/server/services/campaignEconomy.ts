import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { listPcEntityIdsForWorld } from "@/src/server/repos/campaigns";
import { listAllRevisionSnapshots } from "@/src/server/repos/entityRevisions";
import { normalizeStoredSnapshot } from "@/src/server/services/entityHistory";
import { zInventoryBlockData } from "@/src/core/schemas/blocks/inventory";
import { DEFAULT_CURRENCY_SYSTEM, totalValueCp, type CurrencySystem } from "@/src/core/rules/currency";
import { readWorldCurrencySystem } from "@/src/server/services/currencySystem";
import { computeEconomyStats, type CurrencySnapshotDelta, type EconomyStats } from "@/src/core/rules/economyStats";

type TypedClient = SupabaseClient<Database>;

/** Valeur du porte-monnaie (bloc `inventory`) d'un instantane, `null` si l'entite n'avait pas encore ce bloc a cette revision (jamais traite comme un porte-monnaie vide : ca creerait un faux "gain" a l'apparition du bloc). */
export function inventoryValueCp(snapshotJson: unknown, system: CurrencySystem = DEFAULT_CURRENCY_SYSTEM): number | null {
  const snapshot = normalizeStoredSnapshot(snapshotJson as never);
  const block = snapshot.blocks.find((b) => b.blockType === "inventory");
  if (!block) return null;
  const parsed = zInventoryBlockData.safeParse(block.data);
  if (!parsed.success) return null;
  return totalValueCp(parsed.data.currency, system);
}

/** Retour utilisateur (V2-M12) : "argent dépensé, argent gagné" — diffe la valeur du porte-monnaie entre chaque paire de revisions consecutives de chaque PJ de la campagne, meme source (`entity_revisions`) que le journal d'activite (`activityJournal.ts`), mais agrege sur TOUTE l'histoire plutot qu'une fenetre de journal. */
export async function getCampaignEconomyStats(supabase: TypedClient, params: { worldId: string }): Promise<EconomyStats> {
  // V3.1-218 : valeurs selon le système monétaire du monde (une résolution de fiche, en parallèle).
  const [pcEntityIds, system] = await Promise.all([listPcEntityIdsForWorld(supabase, params.worldId), readWorldCurrencySystem(supabase, params.worldId)]);
  const deltas: CurrencySnapshotDelta[] = [];

  await Promise.all(
    pcEntityIds.map(async (entityId) => {
      const snapshots = await listAllRevisionSnapshots(supabase, entityId);
      let previousCp: number | null = null;
      for (const row of snapshots) {
        const currentCp = inventoryValueCp(row.snapshot, system);
        if (currentCp !== null && previousCp !== null) {
          deltas.push({ beforeCp: previousCp, afterCp: currentCp });
        }
        if (currentCp !== null) previousCp = currentCp;
      }
    })
  );

  return computeEconomyStats(deltas);
}
