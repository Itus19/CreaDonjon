import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import { getAiProposalById, updateAiProposalPayload, updateAiProposalStatus } from "@/src/server/repos/aiProposals";
import { getBlockById } from "@/src/server/repos/blocks";
import { updateBlockContent } from "@/src/server/services/blocks";
import { zTextBlockData, type TextBlockData } from "@/src/core/schemas/blocks/text";
import type { Segment } from "@/src/core/schemas/entities/segments";

type TypedClient = SupabaseClient<Database>;

export type ApplyAiProposalOutcome =
  | { ok: true }
  | { ok: false; reason: "not_found" | "not_pending" | "unsupported_kind" | "block_not_found" | "forbidden" | "conflict" };

type TextBlockEditOutcome = { ok: true } | { ok: false; reason: "block_not_found" | "segment_not_found" | "forbidden" | "conflict" };

/**
 * Réécrit les segments d'un bloc `text` d'une entité, en une révision
 * (`changeSource: "ai"`). `change` rend les segments suivants, ou `null` si le
 * segment visé n'y est pas. Le droit d'écrire est vérifié par
 * `updateBlockContent` (`canUserEditEntityById`), jamais ici.
 * `...currentData` plutôt qu'un objet reconstruit : rien d'autre du bloc ne
 * doit changer (la lettrine, V2.1-14, y aurait été perdue).
 */
async function editTextBlock(
  supabase: TypedClient,
  params: { blockId: string; entityId: string | null; userId: string; change: (segments: Segment[]) => Segment[] | null }
): Promise<TextBlockEditOutcome> {
  const block = await getBlockById(supabase, params.blockId);
  if (!block || block.entity_id !== params.entityId || block.block_type !== "text") return { ok: false, reason: "block_not_found" };
  const currentData = zTextBlockData.parse(block.data);
  const segments = params.change(currentData.segments);
  if (!segments) return { ok: false, reason: "segment_not_found" };
  const nextData: TextBlockData = { ...currentData, segments };
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
  if (result.ok) return { ok: true };
  return { ok: false, reason: result.reason === "forbidden" ? "forbidden" : "conflict" };
}

/** Le paragraphe public qu'une proposition ajoute. Son identifiant est celui de la proposition (V3.2-27) : on le retrouve pour le corriger ou le retirer. */
function paragraph(id: string, text: string): Segment {
  return { id, blockType: "paragraph", visibility: { level: "public", scopeId: null }, content: [{ t: "text", v: text }], align: "left" };
}

/** V3.2-27 — ajoute le paragraphe d'une note du monde à la fin du bloc. */
export function appendNoteSegment(supabase: TypedClient, params: { blockId: string; entityId: string; segmentId: string; text: string; userId: string }): Promise<TextBlockEditOutcome> {
  return editTextBlock(supabase, { ...params, change: (segments) => [...segments, paragraph(params.segmentId, params.text)] });
}

/**
 * Relecture humaine (V1-F3) : applique une proposition `pending` qu'une
 * personne a acceptée. Le texte proposé devient un nouveau segment ajouté à
 * la fin du bloc (jamais un remplacement), visibilité publique par défaut.
 * Depuis ADR 0114, une note du monde du solo est ajoutée d'office
 * (`proposeWorldNote`) ; elle ne passe ici que si cet ajout a échoué.
 *
 * **V3-C5 — « modifier ».** `overrideText` remplace le texte proposé avant
 * l'écriture, si la personne l'a changé au moment d'accepter.
 */
export async function applyAiProposal(
  supabase: TypedClient,
  params: { proposalId: string; userId: string; overrideText?: string }
): Promise<ApplyAiProposalOutcome> {
  const proposal = await getAiProposalById(supabase, params.proposalId);
  if (!proposal) return { ok: false, reason: "not_found" };
  if (proposal.status !== "pending") return { ok: false, reason: "not_pending" };
  if (proposal.kind !== "update_block") return { ok: false, reason: "unsupported_kind" };

  const payload = proposal.payload as { blockId?: string; text?: string };
  const text = params.overrideText?.trim() || payload.text;
  if (!payload.blockId || !text) return { ok: false, reason: "unsupported_kind" };

  const result = await editTextBlock(supabase, {
    blockId: payload.blockId,
    entityId: proposal.targetEntityId,
    userId: params.userId,
    change: (segments) => [...segments, paragraph(proposal.id, text)],
  });
  if (!result.ok) return { ok: false, reason: result.reason === "segment_not_found" ? "block_not_found" : result.reason };

  await updateAiProposalStatus(supabase, {
    id: proposal.id,
    status: "applied",
    reviewedBy: params.userId,
    appliedAt: new Date().toISOString(),
  });
  return { ok: true };
}

export type FixAppliedNoteOutcome = { ok: true } | { ok: false; reason: "not_found" | "not_applied" | "unsupported_kind" | "block_not_found" | "segment_not_found" | "forbidden" | "conflict" };

/** Une note du monde déjà écrite : `update_block` appliquée, dont le segment porte l'identifiant de la proposition. */
async function appliedNote(supabase: TypedClient, proposalId: string) {
  const proposal = await getAiProposalById(supabase, proposalId);
  if (!proposal) return { ok: false as const, reason: "not_found" as const };
  if (proposal.status !== "applied") return { ok: false as const, reason: "not_applied" as const };
  const payload = proposal.payload as { blockId?: unknown; text?: unknown };
  if (proposal.kind !== "update_block" || typeof payload.blockId !== "string") return { ok: false as const, reason: "unsupported_kind" as const };
  return { ok: true as const, proposal, blockId: payload.blockId };
}

/**
 * V3.2-27 (ADR 0114) — « Corriger » : la personne qui joue réécrit une note
 * que le moteur a ajoutée au wiki. Le paragraphe garde sa place et sa
 * visibilité ; la proposition garde le texte réellement écrit.
 */
export async function correctAppliedNote(supabase: TypedClient, params: { proposalId: string; userId: string; text: string }): Promise<FixAppliedNoteOutcome> {
  const found = await appliedNote(supabase, params.proposalId);
  if (!found.ok) return found;
  const text = params.text.trim();
  const result = await editTextBlock(supabase, {
    blockId: found.blockId,
    entityId: found.proposal.targetEntityId,
    userId: params.userId,
    change: (segments) => (segments.some((s) => s.id === found.proposal.id) ? segments.map((s) => (s.id === found.proposal.id ? { ...s, content: [{ t: "text", v: text }] } : s)) : null),
  });
  if (!result.ok) return result;
  await updateAiProposalPayload(supabase, { id: found.proposal.id, payload: { ...(found.proposal.payload as Record<string, unknown>), text } as Json });
  return { ok: true };
}

/**
 * V3.2-27 (ADR 0114) — retire du wiki le paragraphe d'une note du monde
 * (« Retirer », ou l'annulation du tour qui l'a ajoutée). La proposition
 * passe `reverted` : sa ligne reste, comme toute annulation.
 * `segment_not_found` : le paragraphe a déjà disparu (effacé à la main) ;
 * la proposition passe quand même `reverted`, il n'y a plus rien à défaire.
 */
export async function removeAppliedNote(supabase: TypedClient, params: { proposalId: string; userId: string }): Promise<FixAppliedNoteOutcome> {
  const found = await appliedNote(supabase, params.proposalId);
  if (!found.ok) return found;
  const result = await editTextBlock(supabase, {
    blockId: found.blockId,
    entityId: found.proposal.targetEntityId,
    userId: params.userId,
    change: (segments) => (segments.some((s) => s.id === found.proposal.id) ? segments.filter((s) => s.id !== found.proposal.id) : null),
  });
  if (!result.ok && result.reason !== "segment_not_found") return result;
  await updateAiProposalStatus(supabase, { id: found.proposal.id, status: "reverted", reviewedBy: params.userId, appliedAt: found.proposal.appliedAt });
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
