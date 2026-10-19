import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import type { Locale } from "@/src/i18n/request";
import { memberBudgetShares, type EncounterBudgetBand, type EncounterBudgetRow } from "@/src/core/rules/encounter";
import { z } from "zod";
import { listCampaignCharacters } from "@/src/server/repos/campaigns";
import { listEntitiesByIds } from "@/src/server/repos/entities";
import { listBlocksByTypeForEntities } from "@/src/server/repos/blocks";
import { getEncounterBudgetTableForRuleset, listMonstersForRuleset, listSavedEncounters } from "@/src/server/services/encounters";

type TypedClient = SupabaseClient<Database>;

/** Seul ce que l'atelier lit du bloc `character` : les niveaux de classe. Une fiche plus ancienne que le schéma complet garde son niveau. */
const zClassLevels = z.object({ classes: z.array(z.object({ level: z.number().int().min(0) })) });

/** Un PJ de la campagne, pour le groupe de l'atelier de rencontres (V3.1-44). */
export interface EncounterPartyMember {
  entityId: string;
  name: string;
  /** Niveau total (somme des classes) ; 0 pour une fiche sans classe. */
  level: number;
  /** Sa part du budget aux trois paliers, calculée ici ; `null` si son niveau manque à la table : il ne compte pas. */
  shares: Record<EncounterBudgetBand, number> | null;
}

/**
 * Le groupe de l'atelier : les PJ de la campagne avec leur vrai niveau. Trois
 * lectures groupées, jamais une par PJ (C3). Les parts du budget s'ajoutent
 * ensuite (`withBudgetShares`), une fois la table connue : les deux
 * lectures partent en même temps.
 */
export async function listEncounterParty(supabase: TypedClient, campaignId: string): Promise<Omit<EncounterPartyMember, "shares">[]> {
  const pcs = (await listCampaignCharacters(supabase, campaignId)).filter((c) => c.is_pc);
  if (pcs.length === 0) return [];
  const ids = pcs.map((c) => c.entity_id);
  const [entities, blocks] = await Promise.all([listEntitiesByIds(supabase, ids), listBlocksByTypeForEntities(supabase, ids, "character")]);
  const nameById = new Map(entities.map((e) => [e.id, e.name]));
  const levelById = new Map(
    blocks.map((b) => {
      const parsed = zClassLevels.safeParse(b.data);
      return [b.entity_id, parsed.success ? parsed.data.classes.reduce((sum, c) => sum + c.level, 0) : 0] as const;
    })
  );
  return pcs
    .filter((c) => nameById.has(c.entity_id))
    .map((c) => ({ entityId: c.entity_id, name: nameById.get(c.entity_id) ?? "", level: levelById.get(c.entity_id) ?? 0 }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

/**
 * La part de chaque PJ aux trois paliers. L'écran additionne les parts des
 * présents ; il ne calcule aucune règle (`memberBudgetShares` est la ligne
 * de `encounterBudget`, dont le budget est la somme).
 */
export function withBudgetShares(party: Omit<EncounterPartyMember, "shares">[], table: readonly EncounterBudgetRow[] | null): EncounterPartyMember[] {
  return party.map((m) => ({ ...m, shares: table ? memberBudgetShares(m.level, table) : null }));
}

/** Tout ce que l'atelier affiche en arrivant, pour la page comme pour la fenêtre d'outil (C1 : avec la première vue). */
export async function chargerAtelierRencontres(supabase: TypedClient, campaign: { id: string; rulesetId: string }, locale: Locale) {
  const [budgetResolution, monsters, savedEncounters, party] = await Promise.all([
    getEncounterBudgetTableForRuleset(supabase, campaign.rulesetId),
    listMonstersForRuleset(supabase, campaign.rulesetId, locale),
    listSavedEncounters(supabase, campaign.id),
    listEncounterParty(supabase, campaign.id),
  ]);
  return {
    budgetTable: budgetResolution?.rows ?? null,
    budgetIsFallback: budgetResolution?.isFallback ?? false,
    monsters,
    savedEncounters,
    party: withBudgetShares(party, budgetResolution?.rows ?? null),
  };
}
