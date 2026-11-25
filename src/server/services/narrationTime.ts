import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { advanceSceneTime, type GameTime } from "@/src/core/rules/scene";
import { compterMots, dureeExplicite, minutesDeParole, minutesProposees, type ElapsedProposal } from "@/src/core/rules/elapsed";
import { contientParole } from "@/src/core/ai/npcAddressed";
import { getSceneState, putSceneState } from "@/src/server/repos/sceneStates";

type TypedClient = SupabaseClient<Database>;

/** Ce que `playTurn` a déjà compté pour une action hors combat (`minutesForTurn`) : retiré pour ne pas compter deux fois. */
const MINUTES_DEJA_COMPTEES = 1;

/**
 * V3.2-18 (ADR 0112) — Le temps que la narration fait passer, APRÈS elle :
 * la durée proposée par l'IA (`elapsed`, liste fermée) ou le temps de
 * parole, la plus longue des deux, bornée par le moteur (`minutesProposees`).
 *
 * Rien quand le joueur a écrit une durée : `playTurn` l'a déjà appliquée
 * avant la narration, et elle l'emporte toujours sur une proposition de
 * l'IA. Rien en combat. Une lecture de la scène, une écriture seulement si
 * l'horloge bouge.
 *
 * Rend la nouvelle heure, ou `null` si rien n'a bougé. L'annulation du tour
 * (V3-F2) restaure la scène d'avant le tour : ce temps-là est défait avec
 * le reste.
 */
export async function advanceSceneAfterNarration(
  supabase: TypedClient,
  params: { campaignId: string; callerId: string; playerAction: string; elapsed: ElapsedProposal | null; npcReplyText: string | null }
): Promise<GameTime | null> {
  if (dureeExplicite(params.playerAction)) return null;
  const scene = await getSceneState(supabase, params.campaignId);
  if (!scene || scene.activeCombatId) return null;

  const proposees = params.elapsed ? minutesProposees(params.elapsed, scene.time, false) : 0;
  const parle = contientParole(params.playerAction) || params.npcReplyText !== null;
  const parole = parle ? minutesDeParole(compterMots(params.playerAction) + compterMots(params.npcReplyText ?? "")) : 0;
  const minutes = Math.max(proposees, parole) - MINUTES_DEJA_COMPTEES;
  if (minutes <= 0) return null;

  const next = advanceSceneTime(scene, minutes);
  await putSceneState(supabase, { campaignId: params.campaignId, state: next, updatedBy: params.callerId });
  return next.time;
}
