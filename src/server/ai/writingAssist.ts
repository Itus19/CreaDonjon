import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import { zTextProposal, textProposalToolSchema } from "@/src/core/ai/writingProposal";
import type { AiProvider } from "./provider";
import { runAiCompletion } from "./callAi";
import { insertAiProposal, type AiProposalRow } from "@/src/server/repos/aiProposals";

type TypedClient = SupabaseClient<Database>;

const TOOL_NAME = "propose_text";
/** Budget par tour (critere du ticket V1-F3) : au-dela, rejet et journalisation, jamais un silence. */
const MAX_PROPOSALS_PER_TURN = 3;

const SYSTEM_PROMPT =
  "Tu aides a rediger le texte narratif d'une fiche de jeu de role. Propose un paragraphe en francais, " +
  `sans mise en forme ni reference a d'autres fiches, via l'outil ${TOOL_NAME}. Un seul appel, un seul paragraphe.`;

export interface WritingAssistContext {
  worldId: string;
  entityId: string;
  userId: string;
}

/**
 * Assistance redactionnelle (V1-F3). Chaque proposition du modele devient
 * une ligne `ai_proposals` en attente (`kind='update_block'`) — jamais
 * ecrite directement, a la difference de V1-F2 : cette table est concue
 * pour des mutations de bloc (SCHEMA.md §16.2), exactement ce que ce ticket
 * produit, contrairement aux surcharges de `ruleset_entries` de V1-F2 qui
 * n'y avaient pas leur place.
 *
 * "Le modele ne peut referencer que des identifiants fournis dans le
 * contexte du tour" (critere du ticket) : `entityId`/`blockId` viennent
 * toujours de l'appelant (route deja authentifiee sur cette entite),
 * jamais de la sortie du modele — `zTextProposal` n'a meme pas de champ id
 * (src/core/ai/writingProposal.ts).
 *
 * Budget par tour : un appel peut produire plusieurs `tool_calls` (observe
 * en pratique avec un modele local lors de V1-F2). Au-dela de
 * `MAX_PROPOSALS_PER_TURN`, le surplus est ecrit comme une proposition
 * rejetee avec le motif, jamais silencieusement ignore.
 */
export async function proposeTextForBlock(
  supabase: TypedClient,
  provider: AiProvider,
  context: WritingAssistContext,
  blockId: string,
  instruction: string
): Promise<AiProposalRow[]> {
  const result = await runAiCompletion(
    supabase,
    provider,
    { userId: context.userId, campaignId: null, purpose: "assist_writing" },
    {
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: instruction },
      ],
      tools: [{ name: TOOL_NAME, description: "Propose un texte narratif pour ce bloc", inputSchema: textProposalToolSchema }],
    }
  );

  const calls = result.toolCalls.filter((tc) => tc.name === TOOL_NAME);
  const accepted = calls.slice(0, MAX_PROPOSALS_PER_TURN);
  const overBudget = calls.slice(MAX_PROPOSALS_PER_TURN);

  const created: AiProposalRow[] = [];

  for (const call of accepted) {
    const parsed = zTextProposal.safeParse(call.input);
    created.push(
      await insertAiProposal(supabase, {
        worldId: context.worldId,
        campaignId: null,
        kind: "update_block",
        targetEntityId: context.entityId,
        payload: (parsed.success ? { blockId, text: parsed.data.text } : { blockId, raw: call.input }) as Json,
        status: parsed.success ? "pending" : "rejected",
        validationErrors: parsed.success ? null : ({ reason: "invalid", issues: parsed.error.issues } as unknown as Json),
      })
    );
  }

  for (const call of overBudget) {
    created.push(
      await insertAiProposal(supabase, {
        worldId: context.worldId,
        campaignId: null,
        kind: "update_block",
        targetEntityId: context.entityId,
        payload: { blockId, raw: call.input } as Json,
        status: "rejected",
        validationErrors: { reason: "budget_exceeded" } as unknown as Json,
      })
    );
  }

  return created;
}
