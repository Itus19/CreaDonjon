import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";

type TypedClient = SupabaseClient<Database>;

/**
 * V3.1-149 — Les colonnes d'un événement, et ses chiffres du MJ
 * (`session_event_gm_details`) quand l'appelant a le droit de les lire : la
 * RLS rend `null` à un joueur. Une seule requête (ressource imbriquée).
 */
const EVENT_WITH_GM_DETAILS = "id, session_id, seq, kind, actor, actor_user_id, payload, created_at, session_event_gm_details(payload)";

type EventWithGmDetails = SessionEventRow & { session_event_gm_details: { payload: Json } | { payload: Json }[] | null };

/** Les chiffres du MJ recouvrent les phrases des joueurs, clé par clé ; sans eux, l'événement tel que les joueurs le lisent. */
function mergeGmDetails(row: EventWithGmDetails): SessionEventRow {
  const { session_event_gm_details: details, ...event } = row;
  const one = Array.isArray(details) ? details[0] : details;
  const extra = one?.payload;
  if (!extra || typeof extra !== "object" || Array.isArray(extra)) return event;
  const base = event.payload && typeof event.payload === "object" && !Array.isArray(event.payload) ? event.payload : {};
  return { ...event, payload: { ...base, ...extra } };
}

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
    .select(EVENT_WITH_GM_DETAILS)
    .eq("session_id", sessionId)
    .order("seq", { ascending: true });
  if (error) throw new Error(error.message);
  return (data as unknown as EventWithGmDetails[]).map(mergeGmDetails);
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
    .select(EVENT_WITH_GM_DETAILS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mergeGmDetails(data as unknown as EventWithGmDetails) : null;
}

/** V3-B4 — « raconter autrement » retrouve l'application d'un tour passe par SON `payload.from_event`, exactement comme `rule_application` s'y rattache deja lui-meme. `maybeSingle` : un jet sans aucun effet applique (V3-B2, `if (applied.changes.length > 0)`) n'a legitimement aucune ligne a trouver. */
export async function findEventByFromEvent(supabase: TypedClient, sessionId: string, kind: string, fromEventId: string): Promise<SessionEventRow | null> {
  const { data, error } = await supabase
    .from("session_events")
    .select(EVENT_WITH_GM_DETAILS)
    .eq("session_id", sessionId)
    .eq("kind", kind)
    .eq("payload->>from_event", fromEventId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mergeGmDetails(data as unknown as EventWithGmDetails) : null;
}

/**
 * V3-C2 — Les esquisses deja tirees sous ce nom (`payload.source === "sketch"`,
 * ecrit par `sceneSketches.ts`), pour detecter « une esquisse apparait dans
 * une deuxieme scene » : le nom filtre directement en base plutot que de
 * relire tout le fil et parser chaque payload en memoire.
 */
export async function listSketchAppearancesByName(supabase: TypedClient, sessionId: string, name: string): Promise<{ locationId: string }[]> {
  const { data, error } = await supabase
    .from("session_events")
    .select("payload")
    .eq("session_id", sessionId)
    .eq("kind", "world_update")
    .eq("payload->>source", "sketch")
    .eq("payload->>name", name);
  if (error) throw new Error(error.message);
  return data
    .map((row) => (row.payload as { location_id?: unknown } | null)?.location_id)
    .filter((id): id is string => typeof id === "string")
    .map((locationId) => ({ locationId }));
}

/** V3-C5 — Les identifiants seuls, pour borner une requete ailleurs (`ai_proposals.session_event_id IN (...)`) sans relire chaque `payload`. */
export async function listSessionEventIds(supabase: TypedClient, sessionId: string): Promise<string[]> {
  const { data, error } = await supabase.from("session_events").select("id").eq("session_id", sessionId);
  if (error) throw new Error(error.message);
  return data.map((r) => r.id);
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
  // V3.1-149 : compté sur TOUS les événements (fonction de la base) — un joueur ne lit pas ceux du combat.
  const { data, error } = await supabase.rpc("next_session_event_seq", { p_session: sessionId });
  if (error) throw new Error(error.message);
  return data;
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
    /**
     * V3.1-149 : les chiffres réservés au MJ (CA, PV, changements bruts),
     * écrits à part ; `payload` ne porte alors que ce que les joueurs lisent.
     * Seul un administrateur du monde peut les écrire.
     */
    gmDetails?: Json;
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
  if (params.gmDetails === undefined) return data;
  const { error: detailsError } = await supabase.from("session_event_gm_details").insert({ event_id: data.id, payload: params.gmDetails });
  if (detailsError) throw new Error(detailsError.message);
  return mergeGmDetails({ ...data, session_event_gm_details: { payload: params.gmDetails } });
}
