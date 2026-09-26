import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import type { Viewer } from "@/src/core/visibility";
import { buildSoloGmQuestionContext } from "@/src/server/services/turnContext";
import { insertSessionEvent, nextEventSeq } from "@/src/server/repos/sessions";
import type { AiProvider } from "./provider";
import { runAiCompletion } from "./callAi";

type TypedClient = SupabaseClient<Database>;

/**
 * V3-D4 — Le bouton « MJ » : une question posée HORS du temps de jeu.
 *
 * **Ne touche jamais au tour.** Contrairement à `narrateSoloTurn`
 * (V3-B2/B4), cette fonction n'appelle ni `playTurn` ni `executeIntent` —
 * elle ne lit ni n'écrit `entity_runtime_state`, ne fait pas avancer
 * `scene_states.time`, ne dépense aucun budget d'action. C'est précisément
 * la garantie du ticket (« MJ ne fait pas avancer le temps ») : verrouillée
 * par `turnIntent.noAi.test.ts`, qui vérifie que ce fichier et la route qui
 * l'appelle ne mentionnent aucune des fonctions de la boucle de tour.
 *
 * **Journalisée en `note`, jamais en `player_action`/`roll`.** Le fil
 * (V3-D4 Phase 1) l'affiche sur un liseré d'accent qui dit en toutes
 * lettres qu'elle est hors du temps de jeu — jamais confondue avec un fait
 * de tour.
 *
 * **Pas de recherche dans les règles.** Le contexte est le même que pour
 * narrer un tour (scène, PNJ présents, quêtes, dernières narrations) —
 * aucune recherche dans le wiki ou le SRD : ça demande la RAG de V3-E2,
 * qui n'existe pas encore. Une question de règle reçoit donc une réponse
 * du modèle SEUL, sans lecture du contenu réel — une limite assumée du
 * ticket, pas une omission.
 */

const SYSTEM_PROMPT =
  "Tu es le maitre du jeu d'une session de jeu de role solo, et le joueur te pose une question HORS du " +
  "temps de jeu — la scene n'avance pas pendant que tu reponds. Ta reponse n'est jamais un jet ni un fait " +
  "qui change l'etat du jeu : c'est le moteur, jamais toi, qui decide de tout ce qui est mecanique. " +
  "Reponds en deux a quatre phrases, en francais, sans jouer de personnage ni faire avancer la scene. Si " +
  "tu ne sais pas, dis-le plutot que d'inventer.";

export interface SoloGmQuestionParams {
  worldId: string;
  campaignId: string;
  playerEntityId: string;
  /** Le viewer du joueur qui pose la question — jamais un viewer `gm` (règle absolue 11). */
  viewer: Viewer;
  userId: string;
  sessionId: string;
  question: string;
}

export interface SoloGmQuestionOutcome {
  ok: boolean;
  eventId?: string;
  answer?: string;
  invalidReason?: string;
  inputTokens: number;
  outputTokens: number;
}

export async function askSoloGm(supabase: TypedClient, provider: AiProvider, params: SoloGmQuestionParams): Promise<SoloGmQuestionOutcome> {
  const { text: context } = await buildSoloGmQuestionContext(supabase, {
    worldId: params.worldId,
    campaignId: params.campaignId,
    playerEntityId: params.playerEntityId,
    viewer: params.viewer,
    sessionId: params.sessionId,
    question: params.question,
  });

  const result = await runAiCompletion(supabase, provider, { userId: params.userId, campaignId: params.campaignId, purpose: "solo_gm_question" }, {
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: context },
    ],
  });

  const answer = result.text.trim();
  if (answer.length === 0) {
    return { ok: false, invalidReason: "réponse vide", inputTokens: result.inputTokens, outputTokens: result.outputTokens };
  }

  const seq = await nextEventSeq(supabase, params.sessionId);
  const event = await insertSessionEvent(supabase, {
    sessionId: params.sessionId,
    seq,
    kind: "note",
    actor: "ai",
    actorUserId: params.userId,
    payload: { __v: 1, question: params.question, answer } as unknown as Json,
  });

  return { ok: true, eventId: event.id, answer, inputTokens: result.inputTokens, outputTokens: result.outputTokens };
}
