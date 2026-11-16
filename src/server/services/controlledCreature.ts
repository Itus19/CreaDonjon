import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { getParticipantCharacteristics, type ParticipantCharacteristics } from "@/src/server/services/combats";
import { readCombatParticipantsSigned } from "@/src/server/services/engineSigning";
import type { Locale } from "@/src/i18n/request";

type TypedClient = SupabaseClient<Database>;

/**
 * V3.1-184 (ADR 0078) — ce qu'une joueuse lit de la créature qu'elle pilote
 * (son bloc de stats, ses actions), pour la faire agir. Seulement la sienne :
 * `controlled_by` est relu par la lecture signée du moteur, jamais pris au
 * client. `null` : pas une créature qu'elle pilote dans ce combat.
 *
 * Coût (QUOTAS) : une lecture signée du combat, la campagne et la fiche de
 * règle de la créature ; à la demande (la joueuse déplie sa créature).
 */
export async function getControlledCreatureCharacteristics(
  supabase: TypedClient,
  params: { campaignId: string; combatId: string; participantId: string; userId: string; locale: Locale },
): Promise<ParticipantCharacteristics | null> {
  const rows = await readCombatParticipantsSigned(supabase, { campaignId: params.campaignId, combatId: params.combatId });
  const ligne = rows.find((r) => r.id === params.participantId);
  if (!ligne || ligne.controlled_by !== params.userId || ligne.source_kind !== "statblock") return null;
  return getParticipantCharacteristics(supabase, { participant: ligne, campaignId: params.campaignId, locale: params.locale });
}
