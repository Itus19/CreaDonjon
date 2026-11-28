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
import { deleteRuntimeState, putRuntimeState } from "@/src/server/repos/runtimeState";
import { putSceneState } from "@/src/server/repos/sceneStates";
import { zInventoryBlockData } from "@/src/core/schemas/blocks/inventory";
import { restoreInventory } from "@/src/server/services/inventoryActions";
import { removeAppliedNote } from "@/src/server/services/aiProposals";
import { deleteCombatById } from "@/src/server/services/combats";

type TypedClient = SupabaseClient<Database>;

export type UndoTurnResult =
  | {
      ok: true;
      /** Les événements du tour défait (le fil les cache désormais). */
      undoneEventIds: string[];
      reverted: { entities: number; proposals: number; discoveries: number; effects: number; state: boolean; scene: boolean; inventory: boolean };
    }
  | { ok: false; reason: "not_found" | "not_solo" | "forbidden" | "nothing_to_undo" };

/**
 * V3-F2 (PDD §29 « Annulation ») — annuler le dernier tour d'une partie solo.
 * Le journal reste en ajout seul : un événement `system` (`undo_turn`) nomme
 * les événements défaits, jamais une suppression. Ce que le tour avait écrit
 * est retiré ou restauré :
 * - les fiches nées automatiquement (`auto_applied`) passent à la corbeille
 *   (suppression douce), leur proposition à `reverted` ; une note du monde
 *   ajoutée d'office (V3.2-27) quitte le wiki ; une proposition en
 *   attente aussi. Une proposition acceptée à la main reste : c'était un choix ;
 * - les découvertes posées par le tour sont retirées ;
 * - l'état de jeu du personnage et la scène reviennent à ceux relevés au début
 *   du tour (`undo_before`), et les effets posés depuis sont retirés ;
 * - l'inventaire revient à celui du début du tour (V3.2-8 : un échange l'a
 *   peut-être modifié), s'il a été relevé.
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
      // V3.2-27 : une note du monde ajoutée d'office quitte le wiki avec son tour.
      if (p.kind === "update_block") {
        const retrait = await removeAppliedNote(supabase, { proposalId: p.id, userId: params.callerId });
        if (retrait.ok) proposals += 1;
        else console.error("Note du monde du tour non retirée", p.id, retrait.reason);
        continue;
      }
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
  let inventory = false;
  if (tour.before) {
    effects = await deleteFeatureEffectsCreatedSince(supabase, { entityId: tour.before.entity_id, campaignId: params.campaignId, since: debut });
    if (tour.before.runtime === null) {
      // Pas encore d'état en base au début du tour : la ligne écrite depuis s'en va, l'état par défaut revient.
      await deleteRuntimeState(supabase, { entityId: tour.before.entity_id, campaignId: params.campaignId });
      state = true;
    } else {
      const runtime = zRuntimeState.safeParse(tour.before.runtime);
      if (runtime.success) {
        await putRuntimeState(supabase, { entityId: tour.before.entity_id, campaignId: params.campaignId, state: runtime.data as unknown as Json });
        state = true;
      }
    }
    const sceneAvant = zSceneState.safeParse(tour.before.scene);
    if (sceneAvant.success) {
      await putSceneState(supabase, { campaignId: params.campaignId, state: sceneAvant.data, updatedBy: params.callerId });
      scene = true;
    }
    if (tour.before.inventory !== undefined) {
      const avant = tour.before.inventory === null ? null : zInventoryBlockData.safeParse(tour.before.inventory);
      if (avant === null || avant.success) {
        inventory = await restoreInventory(supabase, { entityId: tour.before.entity_id, before: avant === null ? null : avant.data, actorUserId: params.callerId });
      } else {
        console.error("Inventaire relevé illisible, non restauré", tour.before.entity_id, avant.error.issues);
      }
    }
  }

  // 3 ter. ADR 0123 : les sacs d'autres fiches que le tour a remplis (le butin d'un voleur) reviennent comme avant.
  for (const autre of tour.othersInventoryBefore ?? []) {
    const avant = autre.inventory === null ? null : zInventoryBlockData.safeParse(autre.inventory);
    if (avant !== null && !avant.success) {
      console.error("Inventaire relevé d'une autre fiche illisible, non restauré", autre.entity_id, avant.error.issues);
      continue;
    }
    if (await restoreInventory(supabase, { entityId: autre.entity_id, before: avant === null ? null : avant.data, actorUserId: params.callerId })) inventory = true;
  }

  // 3 bis. ADR 0121 : le combat que l'attaque du tour a ouvert s'en va avec elle. La scène relevée au début du
  // tour le citait déjà (il s'ouvre avant le jet) : elle repart sans combat en cours.
  const combatsOuverts = lignes
    .filter((l) => tour.eventIds.includes(l.id))
    .map((l) => (l.payload as Record<string, unknown> | null)?.combat_opened_id)
    .filter((id): id is string => typeof id === "string");
  for (const combatId of combatsOuverts) await deleteCombatById(supabase, combatId);
  if (combatsOuverts.length > 0 && scene) {
    const sceneAvant = zSceneState.safeParse(tour.before?.scene);
    if (sceneAvant.success && sceneAvant.data.activeCombatId !== null && combatsOuverts.includes(sceneAvant.data.activeCombatId)) {
      await putSceneState(supabase, { campaignId: params.campaignId, state: { ...sceneAvant.data, activeCombatId: null }, updatedBy: params.callerId });
    }
  }

  // 4. Le journal : une annulation s'ajoute, rien ne s'efface.
  const reverted = { entities, proposals, discoveries, effects, state, scene, inventory };
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
