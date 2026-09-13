import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import {
  createSession,
  getOpenSessionForCampaign,
  getSessionById,
  listSessionEvents,
  updateSessionSummary,
  type SessionEventRow,
  type SessionRow,
} from "@/src/server/repos/sessions";

type TypedClient = SupabaseClient<Database>;

/**
 * Aucune gestion de seance n'existe encore dans l'application (pas de
 * bouton « demarrer une seance ») : les actions de jeu de la fiche jouable
 * (V1-B5 — attaque, repos) ont neanmoins besoin d'une session a laquelle
 * rattacher leur `session_event`/`dice_roll`. Decision de perimetre :
 * ouvre implicitement la derniere session sans `ended_at`, ou en cree une
 * a la volee. Une vraie interface de gestion de seance (demarrer, clore,
 * resumer) reste un ticket a part, non demande ici.
 */
export async function getOrOpenSessionForCampaign(supabase: TypedClient, campaignId: string): Promise<string> {
  const existing = await getOpenSessionForCampaign(supabase, campaignId);
  if (existing) return existing.id;
  const created = await createSession(supabase, campaignId);
  return created.id;
}

export async function getSessionSummary(supabase: TypedClient, sessionId: string): Promise<SessionRow | null> {
  return getSessionById(supabase, sessionId);
}

export async function setSessionSummary(supabase: TypedClient, sessionId: string, summary: string): Promise<SessionRow> {
  return updateSessionSummary(supabase, sessionId, summary);
}

export async function getSessionEvents(supabase: TypedClient, sessionId: string): Promise<SessionEventRow[]> {
  return listSessionEvents(supabase, sessionId);
}
