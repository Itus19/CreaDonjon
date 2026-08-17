import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import type { Locale } from "@/src/i18n/request";
import { skillProbabilityTable, DEFAULT_PROBABILITY_DCS, type SkillProbabilityRow } from "@/src/core/rules/probability";
import { listCampaignCharacters } from "@/src/server/repos/campaigns";
import { listEntitiesByIds } from "@/src/server/repos/entities";
import { resolveCharacterActionContext } from "@/src/server/services/characterActions";

type TypedClient = SupabaseClient<Database>;

export interface PartyMemberProbabilities {
  entityId: string;
  characterName: string;
  rows: SkillProbabilityRow[];
}

/**
 * Tableau MJ des probabilites de reussite (V1-E5, specs/arbitrage-modifications.md
 * §3.6) : un PJ sans bloc `character` ou sans ruleset resolvable (rare — une
 * fiche vide attribuee a un joueur) est silencieusement absent du resultat,
 * meme discipline que `resolveCharacterActionContext` lui-meme, qui renvoie
 * `null` dans ce cas plutot qu'une erreur — un tableau MJ n'a pas a bloquer
 * sur une fiche incomplete parmi d'autres.
 */
export async function getPartySkillProbabilities(
  supabase: TypedClient,
  campaignId: string,
  locale: Locale,
  dcs: readonly number[] = DEFAULT_PROBABILITY_DCS
): Promise<PartyMemberProbabilities[]> {
  const characters = await listCampaignCharacters(supabase, campaignId);
  const pcs = characters.filter((c) => c.is_pc);
  if (pcs.length === 0) return [];

  const entities = await listEntitiesByIds(
    supabase,
    pcs.map((c) => c.entity_id)
  );
  const nameByEntityId = new Map(entities.map((e) => [e.id, e.name]));

  const results: PartyMemberProbabilities[] = [];
  for (const pc of pcs) {
    const ctx = await resolveCharacterActionContext(supabase, pc.entity_id, campaignId, locale);
    if (!ctx) continue;
    results.push({
      entityId: pc.entity_id,
      characterName: nameByEntityId.get(pc.entity_id) ?? pc.entity_id,
      rows: skillProbabilityTable(ctx.sheet, dcs),
    });
  }
  return results;
}
