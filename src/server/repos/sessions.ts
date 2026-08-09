import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";

type TypedClient = SupabaseClient<Database>;

export interface SessionRow {
  id: string;
  campaign_id: string;
  started_at: string;
  ended_at: string | null;
}

/** La session la plus recente sans `ended_at` — `null` si aucune n'est ouverte (SCHEMA.md §12 : `ended_at` marque la fin). */
export async function getOpenSessionForCampaign(supabase: TypedClient, campaignId: string): Promise<SessionRow | null> {
  const { data, error } = await supabase
    .from("sessions")
    .select("id, campaign_id, started_at, ended_at")
    .eq("campaign_id", campaignId)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function createSession(supabase: TypedClient, campaignId: string): Promise<SessionRow> {
  const { data, error } = await supabase
    .from("sessions")
    .insert({ campaign_id: campaignId })
    .select("id, campaign_id, started_at, ended_at")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export interface SessionEventRow {
  id: string;
  session_id: string;
  seq: number;
  kind: string;
  actor: string;
  actor_user_id: string | null;
  payload: Json;
  created_at: string;
}

/** Prochain `seq` d'une session (SCHEMA.md §12 : journal en ajout seul, unique(session_id, seq)). 1 si la session n'a encore aucun evenement. */
export async function nextEventSeq(supabase: TypedClient, sessionId: string): Promise<number> {
  const { data, error } = await supabase
    .from("session_events")
    .select("seq")
    .eq("session_id", sessionId)
    .order("seq", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.seq ?? 0) + 1;
}

/**
 * Ajoute un evenement au journal — jamais de mise a jour ni de suppression
 * ici (specs/wiki-blocs.md §4.5) : annuler un tour ecrit un evenement de
 * compensation, ne retouche jamais un evenement passe.
 */
export async function insertSessionEvent(
  supabase: TypedClient,
  params: {
    sessionId: string;
    seq: number;
    kind: string;
    actor: string;
    actorUserId: string | null;
    payload: Json;
  }
): Promise<SessionEventRow> {
  const { data, error } = await supabase
    .from("session_events")
    .insert({
      session_id: params.sessionId,
      seq: params.seq,
      kind: params.kind,
      actor: params.actor,
      actor_user_id: params.actorUserId,
      payload: params.payload,
    })
    .select("id, session_id, seq, kind, actor, actor_user_id, payload, created_at")
    .single();
  if (error) throw new Error(error.message);
  return data;
}
