import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";

type TypedClient = SupabaseClient<Database>;

export interface PersonalityEventRow {
  id: string;
  entity_id: string;
  summary: string;
  deltas: Json;
  origin: string;
  session_event_id: string | null;
  occurred_at_ingame: string | null;
  created_at: string;
}

/** Journal en ajout seul (docs/adr/0013-tables-psyche-pnj.md) — jamais de mise a jour ni de suppression ici. */
export async function insertPersonalityEvent(
  supabase: TypedClient,
  params: {
    entityId: string;
    summary: string;
    deltas: Json;
    origin: string;
    sessionEventId: string | null;
    occurredAtIngame: string | null;
  }
): Promise<PersonalityEventRow> {
  const { data, error } = await supabase
    .from("personality_events")
    .insert({
      entity_id: params.entityId,
      summary: params.summary,
      deltas: params.deltas,
      origin: params.origin,
      session_event_id: params.sessionEventId,
      occurred_at_ingame: params.occurredAtIngame,
    })
    .select("id, entity_id, summary, deltas, origin, session_event_id, occurred_at_ingame, created_at")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/** Les 20 dernieres d'abord (specs/psyche-pnj.md §4 : « l'ecran recoit les 20 dernieres entrees, le reste replie »). */
export async function listPersonalityEvents(
  supabase: TypedClient,
  entityId: string,
  limit = 20
): Promise<PersonalityEventRow[]> {
  const { data, error } = await supabase
    .from("personality_events")
    .select("id, entity_id, summary, deltas, origin, session_event_id, occurred_at_ingame, created_at")
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data;
}

export interface EntityAttitudeRow {
  id: string;
  campaign_id: string;
  source_entity_id: string;
  target_entity_id: string;
  axes: Json;
  updated_at: string;
}

/** `null` si aucun evenement n'a encore ete journalise pour cette paire dans cette campagne — pas une ligne a zero, une absence. */
export async function getAttitude(
  supabase: TypedClient,
  params: { campaignId: string; sourceEntityId: string; targetEntityId: string }
): Promise<EntityAttitudeRow | null> {
  const { data, error } = await supabase
    .from("entity_attitudes")
    .select("id, campaign_id, source_entity_id, target_entity_id, axes, updated_at")
    .eq("campaign_id", params.campaignId)
    .eq("source_entity_id", params.sourceEntityId)
    .eq("target_entity_id", params.targetEntityId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** Cache reconstructible (docs/adr/0013-tables-psyche-pnj.md) : upsert sur (campaign_id, source_entity_id, target_entity_id), jamais un insert qui dupliquerait la paire. */
export async function upsertAttitude(
  supabase: TypedClient,
  params: { campaignId: string; sourceEntityId: string; targetEntityId: string; axes: Json }
): Promise<EntityAttitudeRow> {
  const { data, error } = await supabase
    .from("entity_attitudes")
    .upsert(
      {
        campaign_id: params.campaignId,
        source_entity_id: params.sourceEntityId,
        target_entity_id: params.targetEntityId,
        axes: params.axes,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "campaign_id,source_entity_id,target_entity_id" }
    )
    .select("id, campaign_id, source_entity_id, target_entity_id, axes, updated_at")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export interface AttitudeEventRow {
  id: string;
  campaign_id: string;
  source_entity_id: string;
  target_entity_id: string;
  summary: string;
  deltas: Json;
  origin: string;
  session_event_id: string | null;
  occurred_at_ingame: string | null;
  created_at: string;
}

/** Journal en ajout seul, par paire (specs/psyche-pnj.md §4). */
export async function insertAttitudeEvent(
  supabase: TypedClient,
  params: {
    campaignId: string;
    sourceEntityId: string;
    targetEntityId: string;
    summary: string;
    deltas: Json;
    origin: string;
    sessionEventId: string | null;
    occurredAtIngame: string | null;
  }
): Promise<AttitudeEventRow> {
  const { data, error } = await supabase
    .from("attitude_events")
    .insert({
      campaign_id: params.campaignId,
      source_entity_id: params.sourceEntityId,
      target_entity_id: params.targetEntityId,
      summary: params.summary,
      deltas: params.deltas,
      origin: params.origin,
      session_event_id: params.sessionEventId,
      occurred_at_ingame: params.occurredAtIngame,
    })
    .select("id, campaign_id, source_entity_id, target_entity_id, summary, deltas, origin, session_event_id, occurred_at_ingame, created_at")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/** Les 20 dernieres de CETTE paire (specs/psyche-pnj.md §4 — jamais un historique global). */
export async function listAttitudeEvents(
  supabase: TypedClient,
  params: { campaignId: string; sourceEntityId: string; targetEntityId: string },
  limit = 20
): Promise<AttitudeEventRow[]> {
  const { data, error } = await supabase
    .from("attitude_events")
    .select("id, campaign_id, source_entity_id, target_entity_id, summary, deltas, origin, session_event_id, occurred_at_ingame, created_at")
    .eq("campaign_id", params.campaignId)
    .eq("source_entity_id", params.sourceEntityId)
    .eq("target_entity_id", params.targetEntityId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data;
}
