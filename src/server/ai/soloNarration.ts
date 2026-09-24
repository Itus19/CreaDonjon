import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import type { Viewer } from "@/src/core/visibility";
import { soloNarrationSchema, soloNarrationToolSchema } from "@/src/core/ai/soloNarrationProposal";
import { buildSoloTurnContext } from "@/src/server/services/turnContext";
import { insertSessionEvent, nextEventSeq } from "@/src/server/repos/sessions";
import type { AiProvider } from "./provider";
import { runAiCompletion } from "./callAi";

type TypedClient = SupabaseClient<Database>;

const TOOL_NAME = "narrate_turn";

const SYSTEM_PROMPT =
  "Tu es le narrateur d'une session de jeu de role solo. Le moteur du jeu calcule deja tous les " +
  "resultats mecaniques (jets, degats, changements d'etat) : ils te sont donnes comme des FAITS deja " +
  "etablis, jamais a recalculer, jamais a re-narrer differemment. Ta seule tache : raconter ce tour en " +
  "deux a quatre phrases, en francais, en integrant les faits fournis sans les contredire. Si un PNJ " +
  "present reagit, utilise UNIQUEMENT un identifiant de PNJ fourni dans le contexte — n'en invente " +
  `jamais. Reponds toujours via l'outil ${TOOL_NAME}, une seule fois.`;

export interface SoloNarrationParams {
  worldId: string;
  campaignId: string;
  playerEntityId: string;
  /** Le viewer du joueur — jamais elevé, borne l'audience du contexte (V3-B3). */
  viewer: Viewer;
  userId: string;
  sessionId: string;
  /** L'événement `roll`/`player_action` que ce tour raconte — porté par `payload.from_event`, comme `rule_application` (V3-B2). */
  fromEventId: string;
  playerAction: string;
  facts: string[];
  changes: string[];
  hints: string[];
}

export interface SoloNarrationOutcome {
  ok: boolean;
  eventId?: string;
  narration?: string;
  npcReaction?: { npcId: string; text: string };
  invalidReason?: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * V3-B2 (câblage de la narration) — L'appel qui manquait : `playTurn`
 * (`turnLoop.ts`) construit les faits sans jamais appeler de modèle ; ce
 * fichier est le seul endroit qui le fait, APRÈS que la mécanique a déjà
 * tout tranché et journalisé.
 *
 * **Jamais essentiel.** Un tour est complet et journalisé avant que cette
 * fonction soit même appelée (`app/api/solo/tour/route.ts` l'appelle en
 * best-effort, après `playTurn`) — un échec ici (fournisseur injoignable,
 * sortie invalide, limite de débit) ne défait rien de ce que la mécanique
 * a déjà écrit. C'est `specs/cible-locale-et-ia.md` §4 appliqué au tour
 * solo : « aucune fonction essentielle ne doit dépendre du succès d'un
 * appel ».
 *
 * **Rejouable pour le même tour** (« raconter ce tour ») : cette fonction
 * ne relit ni ne relance aucun dé — `facts`/`changes`/`hints` viennent
 * TOUJOURS de l'appelant, jamais recalculés ici. Rejouer un tour, c'est
 * rappeler cette fonction avec les mêmes faits et le même `fromEventId` :
 * un nouvel événement `narration` de plus, jamais un nouveau jet.
 */
export async function narrateSoloTurn(supabase: TypedClient, provider: AiProvider, params: SoloNarrationParams): Promise<SoloNarrationOutcome> {
  const { text: context, npcIds } = await buildSoloTurnContext(supabase, {
    worldId: params.worldId,
    campaignId: params.campaignId,
    playerEntityId: params.playerEntityId,
    viewer: params.viewer,
    playerAction: params.playerAction,
    facts: params.facts,
    changes: params.changes,
    hints: params.hints,
  });

  const result = await runAiCompletion(
    supabase,
    provider,
    { userId: params.userId, campaignId: params.campaignId, purpose: "solo_turn" },
    {
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: context },
      ],
      tools: [{ name: TOOL_NAME, description: "Raconte ce tour de jeu solo", inputSchema: soloNarrationToolSchema(npcIds) }],
    }
  );

  const call = result.toolCalls.find((tc) => tc.name === TOOL_NAME);
  if (!call) {
    return { ok: false, invalidReason: "aucun appel d'outil", inputTokens: result.inputTokens, outputTokens: result.outputTokens };
  }

  const parsed = soloNarrationSchema(npcIds).safeParse(call.input);
  if (!parsed.success) {
    const reason = parsed.error.issues.map((i) => `${i.path.join(".") || "(racine)"} : ${i.message}`).join(" ; ");
    return { ok: false, invalidReason: reason, inputTokens: result.inputTokens, outputTokens: result.outputTokens };
  }

  const seq = await nextEventSeq(supabase, params.sessionId);
  const event = await insertSessionEvent(supabase, {
    sessionId: params.sessionId,
    seq,
    kind: "narration",
    actor: "ai",
    actorUserId: params.userId,
    payload: {
      __v: 1,
      from_event: params.fromEventId,
      text: parsed.data.narration,
      npc_reaction: parsed.data.npc_reaction ?? null,
    } as unknown as Json,
  });

  return {
    ok: true,
    eventId: event.id,
    narration: parsed.data.narration,
    npcReaction: parsed.data.npc_reaction ? { npcId: parsed.data.npc_reaction.npc_id, text: parsed.data.npc_reaction.text } : undefined,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  };
}
