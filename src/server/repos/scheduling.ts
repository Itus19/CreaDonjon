import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";

type TypedClient = SupabaseClient<Database>;

export interface AvailabilityRow {
  campaign_id: string;
  user_id: string;
  date: string;
  starts_at: string;
  ends_at: string;
  request_id: string | null;
}

export interface RealSessionRow {
  id: string;
  campaign_id: string;
  scheduled_date: string;
  starts_at: string;
  duration_minutes: number;
  source: string;
  created_by: string;
  created_at: string;
}

export interface AvailabilityRequestRow {
  id: string;
  campaign_id: string;
  title: string;
  candidate_dates: string[];
  starts_at: string;
  ends_at: string;
  status: string;
  created_by: string;
  created_at: string;
}

const AVAILABILITY_COLUMNS = "campaign_id, user_id, date, starts_at, ends_at, request_id";
const REAL_SESSION_COLUMNS = "id, campaign_id, scheduled_date, starts_at, duration_minutes, source, created_by, created_at";
const AVAILABILITY_REQUEST_COLUMNS = "id, campaign_id, title, candidate_dates, starts_at, ends_at, status, created_by, created_at";

export async function getTargetSessionMinutes(supabase: TypedClient, campaignId: string): Promise<number> {
  const { data, error } = await supabase.from("campaigns").select("target_session_minutes").eq("id", campaignId).single();
  if (error) throw new Error(error.message);
  return data.target_session_minutes;
}

export async function setTargetSessionMinutes(supabase: TypedClient, campaignId: string, minutes: number): Promise<void> {
  const { error } = await supabase.from("campaigns").update({ target_session_minutes: minutes }).eq("id", campaignId);
  if (error) throw new Error(error.message);
}

/** Une seule plage par (demande, joueuse, jour) — `upsert` remplace la precedente si elle existe deja (V3.1-190 : contrainte `real_session_availabilities_request_user_date_key` ; avant, la cle etait le jour seul, et deux demandes se seraient ecrasees). */
export async function upsertAvailability(
  supabase: TypedClient,
  params: { campaignId: string; userId: string; date: string; startsAt: string; endsAt: string; requestId: string }
): Promise<AvailabilityRow> {
  const { data, error } = await supabase
    .from("real_session_availabilities")
    .upsert(
      {
        campaign_id: params.campaignId,
        user_id: params.userId,
        date: params.date,
        starts_at: params.startsAt,
        ends_at: params.endsAt,
        request_id: params.requestId,
      },
      { onConflict: "request_id,user_id,date" }
    )
    .select(AVAILABILITY_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteAvailability(supabase: TypedClient, params: { requestId: string; userId: string; date: string }): Promise<void> {
  const { error } = await supabase
    .from("real_session_availabilities")
    .delete()
    .eq("request_id", params.requestId)
    .eq("user_id", params.userId)
    .eq("date", params.date);
  if (error) throw new Error(error.message);
}

/** V3.1-190 — « Aucune date ne me va » efface d'abord les dates deja cochees pour cette demande. */
export async function deleteAvailabilitiesForUserAndRequest(supabase: TypedClient, params: { requestId: string; userId: string }): Promise<void> {
  const { error } = await supabase.from("real_session_availabilities").delete().eq("request_id", params.requestId).eq("user_id", params.userId);
  if (error) throw new Error(error.message);
}

/**
 * V3.1-190 — qui a coche au moins une date, pour plusieurs demandes en une
 * requete : seulement `request_id` et `user_id` (docs/QUOTAS.md Q4), les
 * cartes de l'ecran et les pastilles n'ont pas besoin des plages.
 */
export async function listRespondentsForRequests(supabase: TypedClient, requestIds: string[]): Promise<{ request_id: string; user_id: string }[]> {
  if (requestIds.length === 0) return [];
  const { data, error } = await supabase.from("real_session_availabilities").select("request_id, user_id").in("request_id", requestIds);
  if (error) throw new Error(error.message);
  return data.filter((r): r is { request_id: string; user_id: string } => r.request_id !== null);
}

/** V3.1-190 — les « aucune date ne me va » de plusieurs demandes, en une requete. */
export async function listDeclinesForRequests(supabase: TypedClient, requestIds: string[]): Promise<{ request_id: string; user_id: string }[]> {
  if (requestIds.length === 0) return [];
  const { data, error } = await supabase.from("availability_declines").select("request_id, user_id").in("request_id", requestIds);
  if (error) throw new Error(error.message);
  return data;
}

export async function upsertDecline(supabase: TypedClient, params: { requestId: string; campaignId: string; userId: string }): Promise<void> {
  const { error } = await supabase
    .from("availability_declines")
    .upsert({ request_id: params.requestId, campaign_id: params.campaignId, user_id: params.userId }, { onConflict: "request_id,user_id" });
  if (error) throw new Error(error.message);
}

export async function deleteDecline(supabase: TypedClient, params: { requestId: string; userId: string }): Promise<void> {
  const { error } = await supabase.from("availability_declines").delete().eq("request_id", params.requestId).eq("user_id", params.userId);
  if (error) throw new Error(error.message);
}

/** Toutes les reponses (toutes joueuses confondues) a une ronde precise — le MJ a besoin de tout voir pour le classement. */
export async function listAvailabilitiesForRequest(supabase: TypedClient, requestId: string): Promise<AvailabilityRow[]> {
  const { data, error } = await supabase.from("real_session_availabilities").select(AVAILABILITY_COLUMNS).eq("request_id", requestId);
  if (error) throw new Error(error.message);
  return data;
}

/** Mes propres reponses a une ronde precise (retour utilisateur : jamais celles des autres) — sert aussi de verification "a-t-elle deja repondu" (V3.1-8, pastille). */
export async function listAvailabilitiesForUserAndRequest(supabase: TypedClient, requestId: string, userId: string): Promise<AvailabilityRow[]> {
  const { data, error } = await supabase
    .from("real_session_availabilities")
    .select(AVAILABILITY_COLUMNS)
    .eq("request_id", requestId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return data;
}

export async function insertRealSession(
  supabase: TypedClient,
  params: { campaignId: string; scheduledDate: string; startsAt: string; durationMinutes: number; source: "availability" | "manual"; createdBy: string }
): Promise<RealSessionRow> {
  const { data, error } = await supabase
    .from("real_sessions")
    .insert({
      campaign_id: params.campaignId,
      scheduled_date: params.scheduledDate,
      starts_at: params.startsAt,
      duration_minutes: params.durationMinutes,
      source: params.source,
      created_by: params.createdBy,
    })
    .select(REAL_SESSION_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteRealSession(supabase: TypedClient, id: string): Promise<void> {
  const { error } = await supabase.from("real_sessions").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Toutes les séances d'une campagne, triées chronologiquement — l'appelant sépare passé/futur (le "maintenant" dépend du fuseau de l'appelant, pas du serveur). */
export async function listRealSessions(supabase: TypedClient, campaignId: string): Promise<RealSessionRow[]> {
  const { data, error } = await supabase
    .from("real_sessions")
    .select(REAL_SESSION_COLUMNS)
    .eq("campaign_id", campaignId)
    .order("scheduled_date", { ascending: true })
    .order("starts_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data;
}

/** Cree une demande (V3.1-8). Depuis V3.1-190, plusieurs peuvent etre ouvertes en meme temps. */
export async function insertAvailabilityRequest(
  supabase: TypedClient,
  params: { campaignId: string; title: string; candidateDates: string[]; startsAt: string; endsAt: string; createdBy: string }
): Promise<AvailabilityRequestRow> {
  const { data, error } = await supabase
    .from("availability_requests")
    .insert({
      campaign_id: params.campaignId,
      title: params.title,
      candidate_dates: params.candidateDates,
      starts_at: params.startsAt,
      ends_at: params.endsAt,
      created_by: params.createdBy,
    })
    .select(AVAILABILITY_REQUEST_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/** V3.1-190 — les demandes ouvertes d'une campagne, la plus ancienne d'abord (l'ordre des cartes a l'ecran). */
export async function listOpenAvailabilityRequests(supabase: TypedClient, campaignId: string): Promise<AvailabilityRequestRow[]> {
  const { data, error } = await supabase
    .from("availability_requests")
    .select(AVAILABILITY_REQUEST_COLUMNS)
    .eq("campaign_id", campaignId)
    .eq("status", "open")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data;
}

export async function getAvailabilityRequestById(supabase: TypedClient, id: string): Promise<AvailabilityRequestRow | null> {
  const { data, error } = await supabase.from("availability_requests").select(AVAILABILITY_REQUEST_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** Ferme une ronde (seance confirmee, ou annulee par le MJ) — jamais rouverte, une fermeture est definitive. */
export async function closeAvailabilityRequest(supabase: TypedClient, id: string): Promise<void> {
  const { error } = await supabase.from("availability_requests").update({ status: "closed" }).eq("id", id).eq("status", "open");
  if (error) throw new Error(error.message);
}

/**
 * V3.1-35 — l'accueil : la prochaine séance de chacune de ces campagnes, en
 * UNE requête pour tous les mondes de l'utilisateur. La RLS de
 * `real_sessions` ne rend que celles des campagnes dont il est membre. Même
 * règle que `getNextSession` (services/scheduling.ts) : le moment d'une séance
 * est sa date et son heure de début, et la prochaine est la première à venir.
 */
export async function listNextSessionsForCampaigns(
  supabase: TypedClient,
  campaignIds: string[],
  maintenant: Date
): Promise<Map<string, RealSessionRow>> {
  const prochaines = new Map<string, RealSessionRow>();
  if (campaignIds.length === 0) return prochaines;
  // La veille : une séance d'aujourd'hui, selon le fuseau, peut porter la date d'hier.
  const veille = new Date(maintenant.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("real_sessions")
    .select(REAL_SESSION_COLUMNS)
    .in("campaign_id", campaignIds)
    .gte("scheduled_date", veille)
    .order("scheduled_date", { ascending: true })
    .order("starts_at", { ascending: true });
  if (error) throw new Error(error.message);
  for (const session of data) {
    const moment = new Date(`${session.scheduled_date}T${session.starts_at}`).getTime();
    if (moment < maintenant.getTime() || prochaines.has(session.campaign_id)) continue;
    prochaines.set(session.campaign_id, session);
  }
  return prochaines;
}
