import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import { listBlocksForEntity } from "@/src/server/repos/blocks";
import { insertAiProposal, type AiProposalRow } from "@/src/server/repos/aiProposals";
import { insertSessionEvent, nextEventSeq } from "@/src/server/repos/sessions";
import { appendNoteSegment } from "@/src/server/services/aiProposals";

type TypedClient = SupabaseClient<Database>;

export type ProposeWorldNoteOutcome = { ok: true; proposal: AiProposalRow } | { ok: false; reason: "no_text_block" };

/** La ligne du tour la cite : assez pour reconnaître la note, sans recopier un paragraphe entier. */
const EXTRAIT_MAX = 90;
function extrait(texte: string): string {
  return texte.length <= EXTRAIT_MAX ? texte : `${texte.slice(0, EXTRAIT_MAX - 1).trimEnd()}…`;
}

/**
 * V3-C3, puis V3.2-27 (ADR 0114) — une note rédactionnelle du modèle
 * (`world_note`, `soloNarrationProposal.ts`), déjà validée par Zod et rattachée
 * à une entité connue, est **ajoutée d'office** au wiki : la personne qui joue
 * la corrige ou la retire après coup (onglet « Changements »), au lieu de
 * devoir accepter chaque note. Décidé par l'auteur le 26 novembre 2026.
 *
 * Elle passe toujours par `ai_proposals` (règle absolue 9) : le paragraphe
 * ajouté porte l'identifiant de la proposition, qui la retrouve pour
 * « Corriger », « Retirer » et « Annuler ce tour ». Si l'ajout échoue (droit
 * d'écriture, conflit de version), la note reste en attente de relecture,
 * comme avant. Une ligne `world_update` la cite dans la ligne du tour.
 *
 * **Un seul bloc `text` ciblé, jamais créé ici.** Une entité qui n'en a aucun
 * voit sa note journalisée `rejected`.
 */
export async function proposeWorldNote(
  supabase: TypedClient,
  params: { worldId: string; campaignId: string; sessionId: string; sessionEventId: string; entityId: string; text: string; callerId: string }
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

  const id = crypto.randomUUID();
  const ajout = await appendNoteSegment(supabase, { blockId: textBlock.id, entityId: params.entityId, segmentId: id, text: params.text, userId: params.callerId });
  if (!ajout.ok) console.error("Note du monde non ajoutée d'office, laissée à relire", params.entityId, ajout.reason);

  const proposal = await insertAiProposal(supabase, {
    id,
    worldId: params.worldId,
    campaignId: params.campaignId,
    sessionEventId: params.sessionEventId,
    kind: "update_block",
    targetEntityId: params.entityId,
    payload: { blockId: textBlock.id, text: params.text } as Json,
    status: ajout.ok ? "applied" : "pending",
    autoApplied: ajout.ok,
    appliedAt: ajout.ok ? new Date().toISOString() : null,
  });

  const note = ajout.ok ? `Ajouté au wiki : « ${extrait(params.text)} »` : "Une note pour le wiki attend ta relecture (onglet Changements).";
  await insertSessionEvent(supabase, {
    sessionId: params.sessionId,
    seq: await nextEventSeq(supabase, params.sessionId),
    kind: "world_update",
    actor: "system",
    actorUserId: params.callerId,
    payload: { __v: 1, note, source: "world_note", proposal_id: proposal.id } as unknown as Json,
  });
  return { ok: true, proposal };
}
