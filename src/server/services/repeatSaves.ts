import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import { effectFromRow, effectsDueForRepeatSave, rollRepeatSave } from "@/src/core/rules/durableEffects";
import { ABILITY_LABELS } from "@/src/core/rules/abilities";
import { listFeatureEffectsForBearers } from "@/src/server/repos/activeEffects";
import { listCampaignCharacters } from "@/src/server/repos/campaigns";
import type { CombatParticipantRow } from "@/src/server/repos/combats";
import { insertSessionEvent, nextEventSeq } from "@/src/server/repos/sessions";
import { getCampaign } from "@/src/server/services/campaigns";
import { expireFeatureEffects } from "@/src/server/services/effectExpiry";
import { serverRng } from "@/src/server/services/rng";
import { getOrOpenSessionForCampaign } from "@/src/server/services/sessions";
import { targetSaveBonus } from "@/src/server/services/participantSave";

type TypedClient = SupabaseClient<Database>;

/**
 * V3.1-195 (ADR 0090) — le JS répété à la fin du tour du porteur (Magie
 * envoûtante, la plupart des sorts « la cible refait son jet à la fin de
 * chacun de ses tours »). Appelé par la bascule de tour, au MJ seulement :
 * lecture et écriture directes. Le dé est lancé par le serveur (règle 8),
 * chaque jet va au journal, et une réussite retire l'effet par
 * `expireFeatureEffects` (ses états avec lui, jamais en silence).
 */
export async function rollRepeatSavesAtTurnEnd(
  supabase: TypedClient,
  params: { campaignId: string; combatId: string; ending: CombatParticipantRow; actorUserId: string }
): Promise<{ label: string; roll: number; total: number; dc: number; passed: boolean }[]> {
  const campaign = await getCampaign(supabase, params.campaignId);
  if (!campaign) return [];
  const pcIds = new Set((await listCampaignCharacters(supabase, params.campaignId)).filter((c) => c.is_pc).map((c) => c.entity_id));
  const isPc = params.ending.entity_id !== null && pcIds.has(params.ending.entity_id);
  // Un PJ porte ses effets par son entité ; une autre instance, par `participant:<id>` (ADR 0073).
  const bearer = isPc ? (params.ending.entity_id as string) : `participant:${params.ending.id}`;
  const rows = await listFeatureEffectsForBearers(supabase, {
    campaignId: params.campaignId,
    entityIds: isPc ? [bearer] : [],
    participantIds: isPc ? [] : [params.ending.id],
  });
  const effets = rows.flatMap((row) => {
    const e = effectFromRow(row, bearer);
    return e ? [e] : [];
  });
  const dus = effectsDueForRepeatSave(effets, bearer);
  if (dus.length === 0) return [];

  const jets: { label: string; roll: number; total: number; dc: number; passed: boolean }[] = [];
  const reussis: string[] = [];
  for (const e of dus) {
    const ability = e.repeatSave!.ability;
    const save = await targetSaveBonus(supabase, { target: params.ending, isPc, ability, campaignId: params.campaignId, worldId: campaign.worldId, locale: "fr" });
    const r = rollRepeatSave(e, save, serverRng);
    jets.push({ label: e.label, ...r });
    if (r.passed) reussis.push(e.instanceId);
  }

  const sessionId = await getOrOpenSessionForCampaign(supabase, params.campaignId);
  if (sessionId) {
    const note = jets
      .map((j, i) => `${params.ending.label} refait son JS de ${ABILITY_LABELS[dus[i].repeatSave!.ability]} (${j.label}) : ${j.total} contre DD ${j.dc}, ${j.passed ? "réussi, l'effet prend fin" : "raté"}`)
      .join(" ; ");
    await insertSessionEvent(supabase, {
      sessionId,
      seq: await nextEventSeq(supabase, sessionId),
      kind: "rule_application",
      actor: "gm",
      actorUserId: params.actorUserId,
      payload: { note, repeatSaves: jets } as unknown as Json,
    });
  }

  if (reussis.length > 0) {
    await expireFeatureEffects(supabase, {
      campaignId: params.campaignId,
      events: reussis.map((id) => ({ kind: "save_passed" as const, effectInstanceId: id })),
      callerId: params.actorUserId,
      callerIsGm: true,
      // Sans `participants` : relus par le service, à jour.
      combatId: params.combatId,
    });
  }
  return jets;
}
