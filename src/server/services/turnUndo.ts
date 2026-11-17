import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import { lastUndoableTurn, type JournalEvent } from "@/src/core/rules/turnUndo";
import { zRuntimeState } from "@/src/core/schemas/runtimeState";
import { zSceneState } from "@/src/core/rules/scene";
import { getCampaignById } from "@/src/server/repos/campaigns";
import { getOpenSessionForCampaign, insertSessionEvent, listSessionEvents, nextEventSeq } from "@/src/server/repos/sessions";
import { listAiProposalsBySessionEventIds, updateAiProposalStatus } from "@/src/server/repos/aiProposals";
import { softDeleteEntity } from "@/src/server/repos/entities";
import { deleteDiscoveriesBySourceEvents } from "@/src/server/repos/entityDiscoveries";
import { deleteFeatureEffectsCreatedSince } from "@/src/server/repos/activeEffects";
import { putRuntimeState } from "@/src/server/repos/runtimeState";
import { putSceneState } from "@/src/server/repos/sceneStates";

type TypedClient = SupabaseClient<Database>;

export type UndoTurnResult =
  | {
      ok: true;
      /** Les événements du tour défait (le fil les cache désormais). */
      undoneEventIds: string[];
      reverted: { entities: number; proposals: number; discoveries: number; effects: number; state: boolean; scene: boolean };
    }
  | { ok: false; reason: "not_found" | "not_solo" | "forbidden" | "nothing_to_undo" };

/**
 * V3-F2 (PDD §29 « Annulation ») — annuler le dernier tour d'une partie solo.
 * Le journal reste en ajout seul : un événement `system` (`undo_turn`) nomme
 * les événements défaits, jamais une suppression. Ce que le tour avait écrit
 * est retiré ou restauré :
 * - les fiches nées automatiquement (`auto_applied`) passent à la corbeille
 *   (suppression douce), leur proposition à `reverted` ; une proposition en
 *   attente aussi. Une proposition acceptée à la main reste : c'était un choix ;
 * - les découvertes posées par le tour sont retirées ;
 * - l'état de jeu du personnage et la scène reviennent à ceux relevés au début
 *   du tour (`undo_before`), et les effets posés depuis sont retirés.
 * Un second appel remonte d'un tour.
 *
 * Droit : le MJ de la campagne solo (la joueuse elle-même), vérifié ici.
 * Coût (QUOTAS) : la campagne, la séance et son journal, les propositions du
 * tour ; une écriture par chose défaite ; un événement de journal.
 */
export async function undoLastSoloTurn(supabase: TypedClient, params: { campaignId: string; callerId: string }): Promise<UndoTurnResult> {
  const campaign = await getCampaignById(supabase, params.campaignId);
  if (!campaign) return { ok: false, reason: "not_found" };
  if (campaign.mode !== "solo") return { ok: false, reason: "not_solo" };
  if (campaign.gm_user_id !== params.callerId) return { ok: false, reason: "forbidden" };
  const session = await getOpenSessionForCampaign(supabase, params.campaignId);
  if (!session) return { ok: false, reason: "nothing_to_undo" };

  const lignes = await listSessionEvents(supabase, session.id);
  const journal: JournalEvent[] = lignes.map((l) => ({ id: l.id, seq: l.seq, kind: l.kind, actor: l.actor, payload: (l.payload as Record<string, unknown> | null) ?? {} }));
  const tour = lastUndoableTurn(journal);
  if (!tour) return { ok: false, reason: "nothing_to_undo" };
  const debut = lignes.find((l) => l.id === tour.startId)!.created_at;

  // 1. Les propositions nées du tour.
  let entities = 0;
  let proposals = 0;
  for (const p of await listAiProposalsBySessionEventIds(supabase, tour.eventIds)) {
    if (p.status === "applied" && p.autoApplied) {
      if (p.kind === "create_entity" && p.targetEntityId) {
        if ((await softDeleteEntity(supabase, p.targetEntityId)).deleted) entities += 1;
      }
      await updateAiProposalStatus(supabase, { id: p.id, status: "reverted", reviewedBy: params.callerId, appliedAt: p.appliedAt });
      proposals += 1;
    } else if (p.status === "pending") {
      await updateAiProposalStatus(supabase, { id: p.id, status: "reverted", reviewedBy: params.callerId });
      proposals += 1;
    }
  }

  // 2. Les découvertes du tour.
  const discoveries = await deleteDiscoveriesBySourceEvents(supabase, { campaignId: params.campaignId, eventIds: tour.eventIds });

  // 3. L'état d'avant le tour (absent d'un tour journalisé avant V3-F2 : rien n'est restauré).
  let effects = 0;
  let state = false;
  let scene = false;
  if (tour.before) {
    effects = await deleteFeatureEffectsCreatedSince(supabase, { entityId: tour.before.entity_id, campaignId: params.campaignId, since: debut });
    const runtime = zRuntimeState.safeParse(tour.before.runtime);
    if (runtime.success) {
      await putRuntimeState(supabase, { entityId: tour.before.entity_id, campaignId: params.campaignId, state: runtime.data as unknown as Json });
      state = true;
    }
    const sceneAvant = zSceneState.safeParse(tour.before.scene);
    if (sceneAvant.success) {
      await putSceneState(supabase, { campaignId: params.campaignId, state: sceneAvant.data, updatedBy: params.callerId });
      scene = true;
    }
  }

  // 4. Le journal : une annulation s'ajoute, rien ne s'efface.
  const reverted = { entities, proposals, discoveries, effects, state, scene };
  await insertSessionEvent(supabase, {
    sessionId: session.id,
    seq: await nextEventSeq(supabase, session.id),
    kind: "system",
    actor: "player",
    actorUserId: params.callerId,
    payload: { __v: 1, undo_turn: { event_ids: tour.eventIds, from_seq: tour.startSeq, reverted } } as unknown as Json,
  });
  return { ok: true, undoneEventIds: tour.eventIds, reverted };
}
