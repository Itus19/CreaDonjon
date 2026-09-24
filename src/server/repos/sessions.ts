import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";

type TypedClient = SupabaseClient<Database>;

export interface SessionRow {
  id: string;
  campaign_id: string;
  title: string | null;
  summary: string | null;
  started_at: string;
  ended_at: string | null;
}

export async function getSessionById(supabase: TypedClient, id: string): Promise<SessionRow | null> {
  const { data, error } = await supabase
    .from("sessions")
    .select("id, campaign_id, title, summary, started_at, ended_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** Le resume glissant d'une session (docs/SCHEMA.md §12) est modifie ici seulement — jamais copie dans un bloc de wiki (V2-H4, `session_log`). */
export async function updateSessionSummary(supabase: TypedClient, id: string, summary: string): Promise<SessionRow> {
  const { data, error } = await supabase
    .from("sessions")
    .update({ summary })
    .eq("id", id)
    .select("id, campaign_id, title, summary, started_at, ended_at")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/** Le fil d'une session, du plus ancien au plus recent — l'ordre naturel d'un journal, oppose a `session_events_session_idx` (seq desc) qui sert le cas "dernier evenement d'abord" (annulation). */
export async function listSessionEvents(supabase: TypedClient, sessionId: string): Promise<SessionEventRow[]> {
  const { data, error } = await supabase
    .from("session_events")
    .select("id, session_id, seq, kind, actor, actor_user_id, payload, created_at")
    .eq("session_id", sessionId)
    .order("seq", { ascending: true });
  if (error) throw new Error(error.message);
  return data;
}

/**
 * V3-B4 — Les `limit` evenements les plus recents d'UN type, plus recent
 * en tete. Filtre et borne cote requete plutot que de relire
 * `listSessionEvents` (tout le fil) et filtrer en memoire — une session
 * grandit sans borne au fil des seances, et ce n'est PAS le cas d'une
 * table de plus de cinq lignes (règle des trois) : c'est la meme requete
 * qu'on rappellera a chaque tour, tant que la partie dure.
 */
export async function listRecentEventsByKind(supabase: TypedClient, sessionId: string, kind: string, limit: number): Promise<SessionEventRow[]> {
  const { data, error } = await supabase
    .from("session_events")
    .select("id, session_id, seq, kind, actor, actor_user_id, payload, created_at")
    .eq("session_id", sessionId)
    .eq("kind", kind)
    .order("seq", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data;
}

export async function getSessionEventById(supabase: TypedClient, id: string): Promise<SessionEventRow | null> {
  const { data, error } = await supabase
    .from("session_events")
    .select("id, session_id, seq, kind, actor, actor_user_id, payload, created_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** V3-B4 — « raconter autrement » retrouve l'application d'un tour passe par SON `payload.from_event`, exactement comme `rule_application` s'y rattache deja lui-meme. `maybeSingle` : un jet sans aucun effet applique (V3-B2, `if (applied.changes.length > 0)`) n'a legitimement aucune ligne a trouver. */
export async function findEventByFromEvent(supabase: TypedClient, sessionId: string, kind: string, fromEventId: string): Promise<SessionEventRow | null> {
  const { data, error } = await supabase
    .from("session_events")
    .select("id, session_id, seq, kind, actor, actor_user_id, payload, created_at")
    .eq("session_id", sessionId)
    .eq("kind", kind)
    .eq("payload->>from_event", fromEventId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** La session la plus recente sans `ended_at` — `null` si aucune n'est ouverte (SCHEMA.md §12 : `ended_at` marque la fin). */
export async function getOpenSessionForCampaign(supabase: TypedClient, campaignId: string): Promise<SessionRow | null> {
  const { data, error } = await supabase
    .from("sessions")
    .select("id, campaign_id, title, summary, started_at, ended_at")
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
    .select("id, campaign_id, title, summary, started_at, ended_at")
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
