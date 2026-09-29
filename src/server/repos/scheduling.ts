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

/** Une seule plage par (campagne, joueuse, jour) — `upsert` remplace la precedente si elle existe deja (cle primaire composite). Repond toujours a une ronde precise (V3.1-8) : `requestId` jamais laisse au hasard cote appelant. */
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
      { onConflict: "campaign_id,user_id,date" }
    )
    .select(AVAILABILITY_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteAvailability(supabase: TypedClient, params: { campaignId: string; userId: string; date: string }): Promise<void> {
  const { error } = await supabase
    .from("real_session_availabilities")
    .delete()
    .eq("campaign_id", params.campaignId)
    .eq("user_id", params.userId)
    .eq("date", params.date);
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

/** Cree une ronde de demande (V3.1-8) — l'unicite "une seule ouverte par campagne" est portee par l'index partiel en base, jamais revérifiée ici (course-safe). */
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

/** La ronde ouverte d'une campagne, s'il y en a une — `null` sinon (jamais plus d'une, garanti par l'index partiel). */
export async function getOpenAvailabilityRequest(supabase: TypedClient, campaignId: string): Promise<AvailabilityRequestRow | null> {
  const { data, error } = await supabase
    .from("availability_requests")
    .select(AVAILABILITY_REQUEST_COLUMNS)
    .eq("campaign_id", campaignId)
    .eq("status", "open")
    .maybeSingle();
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
