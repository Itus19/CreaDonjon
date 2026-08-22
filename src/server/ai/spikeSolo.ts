import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { fenceUntrustedData } from "@/src/core/ai/promptSafety";
import { SPIKE_NPCS, buildSpikeNpcContext, zSpikeTurnProposal, spikeTurnToolSchema } from "@/src/core/ai/spikeSoloProposal";
import type { AiProvider } from "./provider";
import { runAiCompletion } from "./callAi";

type TypedClient = SupabaseClient<Database>;

const TOOL_NAME = "narrate_turn";

const SYSTEM_PROMPT =
  "Tu es le narrateur d'une session de jeu de role solo. Le moteur du jeu calcule deja tous les " +
  "resultats mecaniques (jets, degats) : ils te sont donnes comme des FAITS deja etablis, jamais a " +
  "recalculer, jamais a re-narrer differemment. Ta seule tache : raconter ce tour en deux a quatre " +
  "phrases, en francais, en integrant les faits fournis sans les contredire. Si un PNJ present " +
  "reagit, utilise UNIQUEMENT un identifiant de PNJ fourni dans le contexte — n'en invente jamais. " +
  `Reponds toujours via l'outil ${TOOL_NAME}, une seule fois.`;

export interface SpikeTurnParams {
  locationText: string;
  characterSummary: string;
  recentEvents: string[];
  mechanicalFact: string | null;
  playerAction: string;
}

export interface SpikeTurnOutcome {
  ok: boolean;
  narration?: string;
  npcReaction?: { npcName: string; text: string };
  invalidReason?: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
}

/**
 * V2-S1 : point de passage oblige (comme V1-F2/F3) — passe par
 * `runAiCompletion`, limite de debit et journalisation deja garanties.
 * `purpose: "solo_turn"` (deja dans la liste fermee de V1-F1, jamais
 * utilisee avant ce ticket).
 */
export async function narrateSpikeTurn(
  supabase: TypedClient,
  provider: AiProvider,
  userId: string,
  params: SpikeTurnParams
): Promise<SpikeTurnOutcome> {
  const context = [
    fenceUntrustedData("lieu", params.locationText),
    fenceUntrustedData("pnjs-presents", buildSpikeNpcContext()),
    `Personnage : ${params.characterSummary}`,
    `Cinq derniers evenements :\n${params.recentEvents.slice(-5).map((e, i) => `${i + 1}. ${e}`).join("\n") || "(aucun)"}`,
    params.mechanicalFact ? `Fait mecanique de ce tour : ${params.mechanicalFact}` : null,
    `Action du joueur : ${params.playerAction}`,
  ]
    .filter((part): part is string => Boolean(part))
    .join("\n\n");

  const start = Date.now();
  const result = await runAiCompletion(
    supabase,
    provider,
    { userId, campaignId: null, purpose: "solo_turn" },
    {
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: context },
      ],
      tools: [{ name: TOOL_NAME, description: "Raconte ce tour de jeu solo", inputSchema: spikeTurnToolSchema }],
    }
  );
  const latencyMs = Date.now() - start;

  const call = result.toolCalls.find((tc) => tc.name === TOOL_NAME);
  if (!call) {
    return { ok: false, invalidReason: "aucun appel d'outil", latencyMs, inputTokens: result.inputTokens, outputTokens: result.outputTokens };
  }

  const parsed = zSpikeTurnProposal.safeParse(call.input);
  if (!parsed.success) {
    const reason = parsed.error.issues.map((i) => `${i.path.join(".") || "(racine)"} : ${i.message}`).join(" ; ");
    return { ok: false, invalidReason: reason, latencyMs, inputTokens: result.inputTokens, outputTokens: result.outputTokens };
  }

  const npcReaction = parsed.data.npc_reaction
    ? {
        npcName: SPIKE_NPCS.find((n) => n.id === parsed.data.npc_reaction!.npc_id)?.name ?? parsed.data.npc_reaction.npc_id,
        text: parsed.data.npc_reaction.text,
      }
    : undefined;

  return {
    ok: true,
    narration: parsed.data.narration,
    npcReaction,
    latencyMs,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  };
}
