import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import { listBlocksForEntity } from "@/src/server/repos/blocks";
import { insertAiProposal, type AiProposalRow } from "@/src/server/repos/aiProposals";

type TypedClient = SupabaseClient<Database>;

export type ProposeWorldNoteOutcome = { ok: true; proposal: AiProposalRow } | { ok: false; reason: "no_text_block" };

/**
 * V3-C3 — Une suggestion rédactionnelle du modèle (`world_note`,
 * `soloNarrationProposal.ts`) devient une ligne `ai_proposals` en attente,
 * jamais un texte écrit directement : même mécanisme que l'assistant
 * d'écriture (V1-F3, `writingAssist.ts`) — cette fonction est son second
 * appelant, pas un second mécanisme (`applyAiProposal`/`rejectAiProposal`,
 * `src/server/services/aiProposals.ts`, la relit et l'applique telle quelle).
 *
 * **Un seul bloc `text` ciblé, jamais créé ici.** `applyAiProposal` ne sait
 * ajouter un segment qu'à un bloc `text` existant (V1-F3) ; une entité qui
 * n'en a aucun voit sa suggestion journalisée `rejected` plutôt que
 * d'inventer un second mécanisme d'application (`create_block`) pour un cas
 * que ce ticket n'a pas besoin de couvrir.
 */
export async function proposeWorldNote(
  supabase: TypedClient,
  params: { worldId: string; campaignId: string; sessionEventId: string; entityId: string; text: string }
): Promise<ProposeWorldNoteOutcome> {
  const blocks = await listBlocksForEntity(supabase, params.entityId);
  const textBlock = blocks.find((b) => b.block_type === "text");

  if (!textBlock) {
    await insertAiProposal(supabase, {
      worldId: params.worldId,
      campaignId: params.campaignId,
      sessionEventId: params.sessionEventId,
      kind: "update_block",
      targetEntityId: params.entityId,
      payload: { text: params.text } as Json,
      status: "rejected",
      validationErrors: { reason: "no_text_block" } as unknown as Json,
    });
    return { ok: false, reason: "no_text_block" };
  }

  const proposal = await insertAiProposal(supabase, {
    worldId: params.worldId,
    campaignId: params.campaignId,
    sessionEventId: params.sessionEventId,
    kind: "update_block",
    targetEntityId: params.entityId,
    payload: { blockId: textBlock.id, text: params.text } as Json,
    status: "pending",
  });
  return { ok: true, proposal };
}
