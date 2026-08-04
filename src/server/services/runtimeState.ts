import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import { defaultRuntimeState, zRuntimeState, type RuntimeState } from "@/src/core/schemas/runtimeState";
import { mergeRuntimeState, type RuntimeStatePatch } from "@/src/core/rules/runtimeState";
import { getRuntimeState, putRuntimeState } from "@/src/server/repos/runtimeState";
import { insertSessionEvent, nextEventSeq } from "@/src/server/repos/sessions";

type TypedClient = SupabaseClient<Database>;

/** État d'une entité pour une campagne (ou hors partie si `campaignId` est `null`) — jamais `null` : une entité sans ligne en base a simplement l'état par défaut. */
export async function getEntityRuntimeState(
  supabase: TypedClient,
  entityId: string,
  campaignId: string | null
): Promise<RuntimeState> {
  const row = await getRuntimeState(supabase, entityId, campaignId);
  return row ? zRuntimeState.parse(row.state) : defaultRuntimeState();
}

/**
 * Applique un patch a l'etat de jeu d'une entite et, si une session est
 * fournie, journalise la mutation en `session_event` — jamais en
 * `entity_revision` (specs/wiki-blocs.md §4.5 : ce service n'ecrit jamais
 * dans `entities`/`entity_revisions`, uniquement `entity_runtime_state` et
 * `session_events`). Sans session (etat hors partie), rien a journaliser :
 * il n'existe alors aucune session a laquelle rattacher un evenement.
 */
export async function applyRuntimeStateChange(
  supabase: TypedClient,
  params: {
    entityId: string;
    campaignId: string | null;
    patch: RuntimeStatePatch;
    note: string;
    sessionId?: string | null;
    actor: "player" | "gm" | "ai" | "system";
    actorUserId?: string | null;
  }
): Promise<RuntimeState> {
  const current = await getEntityRuntimeState(supabase, params.entityId, params.campaignId);
  const next = mergeRuntimeState(current, params.patch);
  zRuntimeState.parse(next); // jamais une forme invalide en base

  await putRuntimeState(supabase, {
    entityId: params.entityId,
    campaignId: params.campaignId,
    state: next as unknown as Json,
  });

  if (params.sessionId) {
    const seq = await nextEventSeq(supabase, params.sessionId);
    await insertSessionEvent(supabase, {
      sessionId: params.sessionId,
      seq,
      kind: "world_update",
      actor: params.actor,
      actorUserId: params.actorUserId ?? null,
      payload: { entity_id: params.entityId, patch: params.patch, note: params.note } as unknown as Json,
    });
  }

  return next;
}
