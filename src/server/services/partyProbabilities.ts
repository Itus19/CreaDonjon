import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import type { Locale } from "@/src/i18n/request";
import { checkLines, type CheckLine } from "@/src/core/rules/probability";
import { listCampaignCharacters } from "@/src/server/repos/campaigns";
import { listEntitiesByIds } from "@/src/server/repos/entities";
import { resolveCharacterActionContext } from "@/src/server/services/characterActions";

type TypedClient = SupabaseClient<Database>;

export interface PartyMemberProbabilities {
  entityId: string;
  characterName: string;
  /** Six jets de caractéristique puis dix-huit compétences (V3.1-46) ; la probabilité se calcule au DD choisi. */
  lines: CheckLine[];
}

/**
 * La matrice MJ des probabilités (V1-E5, refaite V3.1-46) : pour chaque PJ de
 * la campagne, ses 24 jets tels que sa fiche les calcule. Rien en base
 * (règle 16) ; le DD se choisit à l'écran, sans nouvel appel. Un PJ sans bloc
 * `character` ou sans ruleset résolvable (une fiche vide attribuée à un
 * joueur) est absent du résultat, comme `resolveCharacterActionContext` le
 * décide : un tableau MJ ne bloque pas sur une fiche incomplète.
 * Les PJ se résolvent ensemble (docs/CABLAGE.md, C3).
 */
export async function getPartyCheckLines(supabase: TypedClient, campaignId: string, locale: Locale): Promise<PartyMemberProbabilities[]> {
  const characters = await listCampaignCharacters(supabase, campaignId);
  const pcs = characters.filter((c) => c.is_pc);
  if (pcs.length === 0) return [];

  const [entities, contexts] = await Promise.all([
    listEntitiesByIds(
      supabase,
      pcs.map((c) => c.entity_id)
    ),
    Promise.all(pcs.map((pc) => resolveCharacterActionContext(supabase, pc.entity_id, campaignId, locale))),
  ]);
  const nameByEntityId = new Map(entities.map((e) => [e.id, e.name]));

  return pcs.flatMap((pc, i) => {
    const ctx = contexts[i];
    if (!ctx) return [];
    return [{ entityId: pc.entity_id, characterName: nameByEntityId.get(pc.entity_id) ?? pc.entity_id, lines: checkLines(ctx.sheet) }];
  });
}
