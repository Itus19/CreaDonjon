import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { listRollsForStats, type RollForStats } from "@/src/server/repos/diceRolls";
import { getSessionById } from "@/src/server/repos/sessions";
import { listAllRevisionSnapshots } from "@/src/server/repos/entityRevisions";
import { computeEconomyStats, type CurrencySnapshotDelta, type EconomyStats } from "@/src/core/rules/economyStats";
import { inventoryValueCp } from "@/src/server/services/campaignEconomy";

type TypedClient = SupabaseClient<Database>;

/**
 * Le contrat des statistiques du joueur (V3.1-89, ADR 0064), lu par V3.1-90
 * et 91. Un personnage, une campagne ; `sinceSessionId` : depuis le début de
 * cette séance. Les jets cachés et secrets n'y entrent jamais (repo).
 */

async function sessionStart(supabase: TypedClient, sinceSessionId: string | undefined): Promise<string | undefined> {
  if (!sinceSessionId) return undefined;
  const session = await getSessionById(supabase, sinceSessionId);
  return session?.started_at;
}

export async function listPlayerRolls(
  supabase: TypedClient,
  params: { campaignId: string; entityId: string; sinceSessionId?: string }
): Promise<RollForStats[]> {
  const sinceCreatedAt = await sessionStart(supabase, params.sinceSessionId);
  return listRollsForStats(supabase, { campaignId: params.campaignId, entityId: params.entityId, ...(sinceCreatedAt ? { sinceCreatedAt } : {}) });
}

/**
 * L'argent gagné et dépensé d'UN personnage : les écarts du porte-monnaie
 * entre deux révisions successives de son bloc `inventory` (la monnaie y vit
 * toujours, V3.1-24 : `changeCurrency` écrit le bloc et donc une révision).
 * Depuis une séance : seuls les écarts dont la révision d'arrivée est
 * postérieure à son début comptent ; la révision d'avant sert de point de départ.
 */
export async function getPlayerEconomy(
  supabase: TypedClient,
  params: { entityId: string; sinceSessionId?: string }
): Promise<EconomyStats> {
  const [snapshots, since] = await Promise.all([listAllRevisionSnapshots(supabase, params.entityId), sessionStart(supabase, params.sinceSessionId)]);
  const deltas: CurrencySnapshotDelta[] = [];
  let previousCp: number | null = null;
  for (const row of snapshots) {
    const currentCp = inventoryValueCp(row.snapshot);
    if (currentCp !== null && previousCp !== null && (!since || row.created_at >= since)) {
      deltas.push({ beforeCp: previousCp, afterCp: currentCp });
    }
    if (currentCp !== null) previousCp = currentCp;
  }
  return computeEconomyStats(deltas);
}
