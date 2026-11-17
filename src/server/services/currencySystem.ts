import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { DEFAULT_CURRENCY_SYSTEM, type CurrencySystem } from "@/src/core/rules/currency";
import { zCurrencySystemBlockData } from "@/src/core/schemas/rule-blocks/blocks";
import { getCampaignById } from "@/src/server/repos/campaigns";
import { getEntityById } from "@/src/server/repos/entities";
import { getWorldDefaultRulesetId } from "@/src/server/repos/worlds";
import { resolveEntryBlocksInRuleset } from "@/src/server/services/rules";

type TypedClient = SupabaseClient<Database>;

/** La fiche « Pièces de monnaie » du SRD 5.2.1, porteuse du bloc `currency_system` (ADR 0102). */
export const CURRENCY_ENTRY_KEY = "standard-exchange-rates";

/**
 * V3.1-218 (ADR 0102) — le système monétaire d'un ruleset : le bloc
 * `currency_system` de la fiche « Pièces de monnaie », surcharges de la chaîne
 * comprises (une variante le remplace, règle 18). Sans bloc, ou bloc mal formé
 * (journalisé), le système par défaut du noyau : jamais d'échec du geste pour
 * une règle absente.
 *
 * Coût (QUOTAS) : la résolution d'une fiche — la chaîne de rulesets, l'entrée,
 * ses blocs, les surcharges (quatre petites lectures).
 */
export async function readCurrencySystem(supabase: TypedClient, rulesetId: string): Promise<CurrencySystem> {
  const resolved = await resolveEntryBlocksInRuleset(supabase, rulesetId, CURRENCY_ENTRY_KEY);
  const data = resolved?.blocksByType.get("currency_system");
  if (data === undefined) return DEFAULT_CURRENCY_SYSTEM;
  const parsed = zCurrencySystemBlockData.safeParse(data);
  if (!parsed.success) {
    console.error("Système monétaire mal formé, système par défaut appliqué", rulesetId, parsed.error.issues);
    return DEFAULT_CURRENCY_SYSTEM;
  }
  return parsed.data;
}

/** Le système d'un monde (son ruleset par défaut). */
export async function readWorldCurrencySystem(supabase: TypedClient, worldId: string): Promise<CurrencySystem> {
  const rulesetId = await getWorldDefaultRulesetId(supabase, worldId);
  return rulesetId ? readCurrencySystem(supabase, rulesetId) : DEFAULT_CURRENCY_SYSTEM;
}

/** Le système qui s'applique à une fiche : celui de la campagne si elle est donnée, sinon celui du monde (même choix que `loadCharacterActionContext`). */
export async function readCurrencySystemForEntity(supabase: TypedClient, params: { entityId: string; campaignId: string | null }): Promise<CurrencySystem> {
  const [entity, campaign] = await Promise.all([
    getEntityById(supabase, params.entityId),
    params.campaignId ? getCampaignById(supabase, params.campaignId) : Promise.resolve(null),
  ]);
  if (campaign?.ruleset_id) return readCurrencySystem(supabase, campaign.ruleset_id);
  return entity ? readWorldCurrencySystem(supabase, entity.world_id) : DEFAULT_CURRENCY_SYSTEM;
}
