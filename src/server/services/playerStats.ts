import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { hasUnattributedRollsBefore, listRollsForStats, listTableD20, type RollForStats } from "@/src/server/repos/diceRolls";
import { getLatestSessionForCampaign, getSessionById } from "@/src/server/repos/sessions";
import { listCampaignCharacters } from "@/src/server/repos/campaigns";
import { listPlayerTitleTiers } from "@/src/server/repos/playerTitleTiers";
import { d20Average, d20Histogram, playerTitles, type PlayerTitle } from "@/src/core/stats/playerStats";
import { listAllRevisionSnapshots } from "@/src/server/repos/entityRevisions";
import { computeEconomyStats, type CurrencySnapshotDelta, type EconomyStats } from "@/src/core/rules/economyStats";
import { inventoryValueCp } from "@/src/server/services/campaignEconomy";

type TypedClient = SupabaseClient<Database>;

/**
 * Le contrat des statistiques du joueur (V3.1-89, ADR 0079), lu par V3.1-90
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

/** Les jets attribués commencent à la migration de V3.1-89 (`20261014090000`) : avant, un jet ne disait pas son personnage. */
const DEBUT_ATTRIBUTION = "2026-10-14T00:00:00Z";

export type PlayerStatsScope = "campaign" | "last_session";

/** Ce que le volet « Tes dés et tes titres » reçoit (V3.1-91) : des chiffres déjà calculés, rien d'autre. */
export type PlayerStatsView =
  | { status: "no_character" }
  | {
      status: "ok";
      scope: PlayerStatsScope;
      /** Vingt compteurs (faces 1 à 20) ; les nombres de 1 et de 20 affichés SONT `counts[0]` et `counts[19]`. */
      histogram: { counts: number[]; total: number; tooFew: boolean };
      average: number | null;
      /** Une case par famille ; `[]` sous cinq jets à d20. */
      titles: PlayerTitle[];
      /** La campagne a des jets d'avant l'attribution, qui ne comptent pas. */
      legacyRolls: boolean;
    };

/**
 * V3.1-91 — Les statistiques de la joueuse qui appelle : SON personnage
 * réclamé dans cette campagne, résolu ici à partir de son compte, jamais
 * d'un identifiant fourni par le client. La moyenne de la table compte les
 * personnages réclamés qui ont lancé au moins un d20 dans la période (elle
 * comprise) ; seuls les jets publics comptent, et seule la moyenne sort de
 * ce service (aucun chiffre d'un autre personnage).
 */
export async function getPlayerStats(
  supabase: TypedClient,
  params: { campaignId: string; userId: string; scope: PlayerStatsScope }
): Promise<PlayerStatsView> {
  const personnages = await listCampaignCharacters(supabase, params.campaignId);
  const reclames = personnages.filter((c) => c.is_pc && c.user_id !== null);
  const sien = reclames.find((c) => c.user_id === params.userId);
  if (!sien) return { status: "no_character" };

  const seance = params.scope === "last_session" ? await getLatestSessionForCampaign(supabase, params.campaignId) : null;
  const sinceSessionId = seance?.id;
  const since = seance?.started_at;

  const [rolls, economie, tableD20, tiers, legacyRolls] = await Promise.all([
    listPlayerRolls(supabase, { campaignId: params.campaignId, entityId: sien.entity_id, ...(sinceSessionId ? { sinceSessionId } : {}) }),
    getPlayerEconomy(supabase, { entityId: sien.entity_id, ...(sinceSessionId ? { sinceSessionId } : {}) }),
    listTableD20(supabase, { campaignId: params.campaignId, entityIds: reclames.map((c) => c.entity_id), ...(since ? { sinceCreatedAt: since } : {}) }),
    listPlayerTitleTiers(supabase),
    hasUnattributedRollsBefore(supabase, { campaignId: params.campaignId, before: DEBUT_ATTRIBUTION }),
  ]);

  const parPersonnage = new Map<string, { n20: number; n1: number }>();
  for (const r of tableD20) {
    const c = parPersonnage.get(r.entityId) ?? { n20: 0, n1: 0 };
    if (r.naturalD20 === 20) c.n20 += 1;
    if (r.naturalD20 === 1) c.n1 += 1;
    parPersonnage.set(r.entityId, c);
  }
  if (!parPersonnage.has(sien.entity_id)) parPersonnage.set(sien.entity_id, { n20: 0, n1: 0 });
  const table = [...parPersonnage.values()];
  const moyenne = (k: "n20" | "n1") => table.reduce((s, c) => s + c[k], 0) / table.length;

  const histogram = d20Histogram(rolls);
  return {
    status: "ok",
    scope: params.scope,
    histogram,
    average: d20Average(rolls),
    titles: playerTitles({
      rolls,
      table: { average20: moyenne("n20"), average1: moyenne("n1") },
      economy: { spentGp: economie.spentCp / 100, earnedGp: economie.earnedCp / 100 },
      tiers,
    }),
    legacyRolls,
  };
}
