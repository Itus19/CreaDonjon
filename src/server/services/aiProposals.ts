import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { getAiProposalById, updateAiProposalStatus } from "@/src/server/repos/aiProposals";
import { getBlockById } from "@/src/server/repos/blocks";
import { updateBlockContent } from "@/src/server/services/blocks";
import { zTextBlockData, type TextBlockData } from "@/src/core/schemas/blocks/text";
import type { Segment } from "@/src/core/schemas/entities/segments";

type TypedClient = SupabaseClient<Database>;

export type ApplyAiProposalOutcome =
  | { ok: true }
  | { ok: false; reason: "not_found" | "not_pending" | "unsupported_kind" | "block_not_found" | "conflict" };

/**
 * Relecture humaine obligatoire (V1-F3, CLAUDE.md regle 7) : applique une
 * proposition `pending`, jamais automatiquement — un utilisateur authentifie
 * doit avoir clique "Accepter". Le texte propose devient un nouveau segment
 * ajoute a la fin du bloc (jamais un remplacement — "insertion", pas
 * reecriture), visibilite publique par defaut comme tout nouveau contenu.
 * `changeSource: "ai"` sur la revision resultante (distingue une edition
 * assistee d'une edition manuelle dans l'historique).
 */
export async function applyAiProposal(
  supabase: TypedClient,
  params: { proposalId: string; userId: string }
): Promise<ApplyAiProposalOutcome> {
  const proposal = await getAiProposalById(supabase, params.proposalId);
  if (!proposal) return { ok: false, reason: "not_found" };
  if (proposal.status !== "pending") return { ok: false, reason: "not_pending" };
  if (proposal.kind !== "update_block") return { ok: false, reason: "unsupported_kind" };

  const payload = proposal.payload as { blockId?: string; text?: string };
  if (!payload.blockId || !payload.text) return { ok: false, reason: "unsupported_kind" };

  const block = await getBlockById(supabase, payload.blockId);
  if (!block || block.entity_id !== proposal.targetEntityId || block.block_type !== "text") {
    return { ok: false, reason: "block_not_found" };
  }

  const currentData = zTextBlockData.parse(block.data);
  const newSegment: Segment = {
    id: crypto.randomUUID(),
    blockType: "paragraph",
    visibility: { level: "public", scopeId: null },
    content: [{ t: "text", v: payload.text }],
    align: "left",
  };
  const nextData: TextBlockData = { __v: 1, segments: [...currentData.segments, newSegment] };

  const result = await updateBlockContent(supabase, {
    id: block.id,
    expectedVersion: block.version,
    display: block.display,
    data: nextData,
    visibilityLevel: block.visibility_level,
    visibilityScopeId: block.visibility_scope_id,
    changedBy: params.userId,
    changeSource: "ai",
  });
  if (!result.ok) return { ok: false, reason: "conflict" };

  await updateAiProposalStatus(supabase, {
    id: proposal.id,
    status: "applied",
    reviewedBy: params.userId,
    appliedAt: new Date().toISOString(),
  });
  return { ok: true };
}

export type RejectAiProposalOutcome = { ok: true } | { ok: false; reason: "not_found" | "not_pending" };

export async function rejectAiProposal(
  supabase: TypedClient,
  params: { proposalId: string; userId: string }
): Promise<RejectAiProposalOutcome> {
  const proposal = await getAiProposalById(supabase, params.proposalId);
  if (!proposal) return { ok: false, reason: "not_found" };
  if (proposal.status !== "pending") return { ok: false, reason: "not_pending" };
  await updateAiProposalStatus(supabase, { id: proposal.id, status: "rejected", reviewedBy: params.userId });
  return { ok: true };
}
