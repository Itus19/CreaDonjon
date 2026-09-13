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

const AVAILABILITY_COLUMNS = "campaign_id, user_id, date, starts_at, ends_at";
const REAL_SESSION_COLUMNS = "id, campaign_id, scheduled_date, starts_at, duration_minutes, source, created_by, created_at";

export async function getTargetSessionMinutes(supabase: TypedClient, campaignId: string): Promise<number> {
  const { data, error } = await supabase.from("campaigns").select("target_session_minutes").eq("id", campaignId).single();
  if (error) throw new Error(error.message);
  return data.target_session_minutes;
}

export async function setTargetSessionMinutes(supabase: TypedClient, campaignId: string, minutes: number): Promise<void> {
  const { error } = await supabase.from("campaigns").update({ target_session_minutes: minutes }).eq("id", campaignId);
  if (error) throw new Error(error.message);
}

/** Une seule plage par (campagne, joueuse, jour) — `upsert` remplace la precedente si elle existe deja (cle primaire composite). */
export async function upsertAvailability(
  supabase: TypedClient,
  params: { campaignId: string; userId: string; date: string; startsAt: string; endsAt: string }
): Promise<AvailabilityRow> {
  const { data, error } = await supabase
    .from("real_session_availabilities")
    .upsert(
      { campaign_id: params.campaignId, user_id: params.userId, date: params.date, starts_at: params.startsAt, ends_at: params.endsAt },
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

/** `fromDate`/`toDate` inclus, format `YYYY-MM-DD` — toutes les joueuses confondues (le MJ a besoin de tout voir pour le recap). */
export async function listAvailabilitiesInRange(supabase: TypedClient, campaignId: string, fromDate: string, toDate: string): Promise<AvailabilityRow[]> {
  const { data, error } = await supabase
    .from("real_session_availabilities")
    .select(AVAILABILITY_COLUMNS)
    .eq("campaign_id", campaignId)
    .gte("date", fromDate)
    .lte("date", toDate);
  if (error) throw new Error(error.message);
  return data;
}

export async function listAvailabilitiesForUserInRange(
  supabase: TypedClient,
  campaignId: string,
  userId: string,
  fromDate: string,
  toDate: string
): Promise<AvailabilityRow[]> {
  const { data, error } = await supabase
    .from("real_session_availabilities")
    .select(AVAILABILITY_COLUMNS)
    .eq("campaign_id", campaignId)
    .eq("user_id", userId)
    .gte("date", fromDate)
    .lte("date", toDate);
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
