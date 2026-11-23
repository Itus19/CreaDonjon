import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { REMOTE_CHANNEL } from "@/src/core/remote/feed";

type TypedClient = SupabaseClient<Database>;

/**
 * Le jeu à distance (ADR 0103) : le fil, les demandes de jet, le dernier lu.
 * Toutes les lectures passent par le client de l'appelant : la RLS filtre
 * les secrets et le DD caché avant que rien ne parte.
 */

/** Le fil ne lit que les messages du canal, et au plus les 300 derniers (QUOTAS Q4). */
export const REMOTE_FEED_LIMIT = 300;

export interface RemoteEventRow {
  id: string;
  seq: number;
  kind: string;
  actor: string;
  actor_user_id: string | null;
  payload: unknown;
  visible_to: string[] | null;
  created_at: string;
}

export async function listRemoteEvents(supabase: TypedClient, sessionId: string): Promise<RemoteEventRow[]> {
  const { data, error } = await supabase
    .from("session_events")
    .select("id, seq, kind, actor, actor_user_id, payload, visible_to, created_at")
    .eq("session_id", sessionId)
    .eq("payload->>channel", REMOTE_CHANNEL)
    .order("seq", { ascending: false })
    .limit(REMOTE_FEED_LIMIT);
  if (error) throw new Error(error.message);
  return data;
}

export interface RollRequestRow {
  id: string;
  campaign_id: string;
  session_id: string;
  event_id: string | null;
  author_user_id: string;
  target_user_id: string;
  target_entity_id: string | null;
  check_kind: string;
  check_key: string;
  label: string;
  advantage: string;
  dc_shown: number | null;
  status: string;
  natural_roll: number | null;
  total: number | null;
  by_hand: boolean | null;
  created_at: string;
}

const ROLL_REQUEST_COLUMNS =
  "id, campaign_id, session_id, event_id, author_user_id, target_user_id, target_entity_id, check_kind, check_key, label, advantage, dc_shown, status, natural_roll, total, by_hand, created_at";

/** Les demandes de la session : en cours, et les 50 dernières répondues (pour les cartes du fil). */
export async function listRollRequests(supabase: TypedClient, sessionId: string): Promise<RollRequestRow[]> {
  const { data, error } = await supabase
    .from("roll_requests")
    .select(ROLL_REQUEST_COLUMNS)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return data;
}

export async function getRollRequest(supabase: TypedClient, requestId: string): Promise<RollRequestRow | null> {
  const { data, error } = await supabase.from("roll_requests").select(ROLL_REQUEST_COLUMNS).eq("id", requestId).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function insertRollRequest(
  supabase: TypedClient,
  params: {
    campaignId: string;
    sessionId: string;
    authorUserId: string;
    targetUserId: string;
    targetEntityId: string | null;
    checkKind: string;
    checkKey: string;
    label: string;
    advantage: string;
    dcShown: number | null;
  }
): Promise<RollRequestRow> {
  const { data, error } = await supabase
    .from("roll_requests")
    .insert({
      campaign_id: params.campaignId,
      session_id: params.sessionId,
      author_user_id: params.authorUserId,
      target_user_id: params.targetUserId,
      target_entity_id: params.targetEntityId,
      check_kind: params.checkKind,
      check_key: params.checkKey,
      label: params.label,
      advantage: params.advantage,
      dc_shown: params.dcShown,
    })
    .select(ROLL_REQUEST_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/** Rattache la demande au message du MJ qui la porte (écrit juste après elle). */
export async function setRollRequestEvent(supabase: TypedClient, params: { requestId: string; eventId: string }): Promise<void> {
  const { error } = await supabase.from("roll_requests").update({ event_id: params.eventId }).eq("id", params.requestId);
  if (error) throw new Error(error.message);
}

/** Le DD caché, lisible du MJ seul (RLS de `roll_request_gm_details`). */
export async function insertRollRequestHiddenDc(supabase: TypedClient, params: { requestId: string; dc: number }): Promise<void> {
  const { error } = await supabase.from("roll_request_gm_details").insert({ request_id: params.requestId, dc: params.dc });
  if (error) throw new Error(error.message);
}

export async function listHiddenDcs(supabase: TypedClient, requestIds: string[]): Promise<Map<string, number>> {
  if (requestIds.length === 0) return new Map();
  const { data, error } = await supabase.from("roll_request_gm_details").select("request_id, dc").in("request_id", requestIds);
  if (error) throw new Error(error.message);
  return new Map(data.map((d) => [d.request_id, d.dc]));
}

/** La réponse, par la fonction de la base : `null` si refusée (pas la joueuse visée, déjà répondue, annulée). */
export async function answerRollRequestRow(
  supabase: TypedClient,
  params: { requestId: string; natural: number; total: number; byHand: boolean; answerEventId: string | null }
): Promise<boolean> {
  const { data, error } = await supabase.rpc("answer_roll_request", {
    p_request: params.requestId,
    p_natural: params.natural,
    p_total: params.total,
    p_by_hand: params.byHand,
    p_answer_event: params.answerEventId,
  });
  if (error) throw new Error(error.message);
  return data !== null;
}

export async function cancelRollRequest(supabase: TypedClient, requestId: string): Promise<boolean> {
  const { data, error } = await supabase.from("roll_requests").update({ status: "cancelled" }).eq("id", requestId).eq("status", "pending").select("id");
  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}

export async function getSessionReadSeq(supabase: TypedClient, params: { sessionId: string; userId: string }): Promise<number | null> {
  const { data, error } = await supabase.from("session_reads").select("last_seq").eq("session_id", params.sessionId).eq("user_id", params.userId).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? data.last_seq : null;
}

export async function upsertSessionRead(supabase: TypedClient, params: { sessionId: string; userId: string; lastSeq: number }): Promise<void> {
  const { error } = await supabase
    .from("session_reads")
    .upsert({ session_id: params.sessionId, user_id: params.userId, last_seq: params.lastSeq, updated_at: new Date().toISOString() }, { onConflict: "session_id,user_id" });
  if (error) throw new Error(error.message);
}

/** Les noms des personnages de la table, en une requête (C4). */
export async function getEntityNames(supabase: TypedClient, entityIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(entityIds)];
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase.from("entities").select("id, name").in("id", ids);
  if (error) throw new Error(error.message);
  return new Map(data.map((e) => [e.id, e.name]));
}
