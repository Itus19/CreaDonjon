import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import {
  deleteAvailability as deleteAvailabilityRow,
  deleteRealSession as deleteRealSessionRow,
  getTargetSessionMinutes,
  insertRealSession,
  listAvailabilitiesForUserInRange,
  listAvailabilitiesInRange,
  listRealSessions,
  setTargetSessionMinutes as setTargetSessionMinutesRow,
  upsertAvailability as upsertAvailabilityRow,
  type AvailabilityRow,
  type RealSessionRow,
} from "@/src/server/repos/scheduling";
import { listCampaignMembers, listCampaignCharacters } from "@/src/server/repos/campaigns";
import { listEntitiesByIds } from "@/src/server/repos/entities";
import { classifySession, computeOverlap, rankDays, timeToMinutes, minutesToTime, type DayCandidate } from "@/src/core/scheduling/overlap";

type TypedClient = SupabaseClient<Database>;

export { upsertAvailabilityRow as upsertAvailability, deleteAvailabilityRow as deleteAvailability, listAvailabilitiesForUserInRange };
export type { AvailabilityRow, RealSessionRow };

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export interface RosterEntry {
  userId: string;
  /** Nom du PJ (retour utilisateur : les comptes s'identifient par leur personnage partout ailleurs dans l'app, jamais par un nom de compte) — `null` si ce compte n'a pas encore de PJ dans cette campagne. */
  name: string | null;
  startsAt: string;
  endsAt: string;
}

export interface RankedDay extends DayCandidate {
  roster: RosterEntry[];
}

/** (compte → nom du PJ) pour une campagne — même identité que partout ailleurs dans l'app (`campaign_characters` → entité), jamais le nom de compte. Exportée : réutilisée telle quelle par le Livre de sessions (V2.1-3, même besoin exact de roster). */
export async function resolvePlayerNames(supabase: TypedClient, campaignId: string): Promise<Map<string, string>> {
  const characters = await listCampaignCharacters(supabase, campaignId);
  const pcs = characters.filter((c) => c.is_pc && c.user_id !== null);
  const entities = await listEntitiesByIds(supabase, pcs.map((c) => c.entity_id));
  const nameByEntity = new Map(entities.map((e) => [e.id, e.name]));
  return new Map(pcs.map((c) => [c.user_id as string, nameByEntity.get(c.entity_id) ?? "?"]));
}

/**
 * Classement des jours candidats d'un mois (V2.1-4, piste F) : croise les
 * disponibilités déjà déposées avec l'effectif réel de joueuses de la
 * campagne, calcule le chevauchement horaire de chaque jour
 * (`src/core/scheduling/overlap.ts`, pur/testé) et renvoie les jours triés
 * du meilleur au moins bon, avec le détail par joueuse (roster affiché au
 * clic). `totalMembers` exclut le MJ — le classement répond à "combien de
 * joueuses", pas "combien de personnes en comptant moi-même qui n'ai pas
 * besoin d'être disponible pour ma propre table".
 */
export async function getRankedDaysForMonth(supabase: TypedClient, campaignId: string, year: number, month: number): Promise<RankedDay[]> {
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const to = `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth(year, month)).padStart(2, "0")}`;
  const [availabilities, members, targetMinutes, namesByUser] = await Promise.all([
    listAvailabilitiesInRange(supabase, campaignId, from, to),
    listCampaignMembers(supabase, campaignId),
    getTargetSessionMinutes(supabase, campaignId),
    resolvePlayerNames(supabase, campaignId),
  ]);
  const totalMembers = members.filter((m) => m.role === "player").length;

  const byDate = new Map<string, AvailabilityRow[]>();
  for (const row of availabilities) {
    const existing = byDate.get(row.date);
    if (existing) existing.push(row);
    else byDate.set(row.date, [row]);
  }

  const days: RankedDay[] = [];
  for (const [date, rows] of byDate) {
    const overlap = computeOverlap(rows.map((r) => ({ userId: r.user_id, startsAt: timeToMinutes(r.starts_at), endsAt: timeToMinutes(r.ends_at) })));
    if (!overlap) continue;
    days.push({
      date,
      participantCount: rows.length,
      totalMembers,
      overlap,
      category: classifySession(overlap.durationMinutes, targetMinutes),
      roster: rows.map((r) => ({ userId: r.user_id, name: namesByUser.get(r.user_id) ?? null, startsAt: r.starts_at, endsAt: r.ends_at })),
    });
  }
  return rankDays(days) as RankedDay[];
}

/** Qui a répondu quoi pour un jour précis (roster affiché au clic, V2.1-4) — recalculé depuis les mêmes lignes que le classement, jamais une deuxième source. */
/** Confirme une séance, depuis le classement de disponibilités ou manuellement (retour utilisateur : "le MJ doit pouvoir mettre manuellement la prochaine date... sans passer par l'outil") — même écriture, `source` ne fait que changer l'étiquette affichée ensuite. Aucune limite au nombre de séances par mois (retour utilisateur). */
export async function createRealSession(
  supabase: TypedClient,
  params: { campaignId: string; date: string; startsAt: string; durationMinutes: number; source: "availability" | "manual"; createdBy: string }
): Promise<RealSessionRow> {
  return insertRealSession(supabase, {
    campaignId: params.campaignId,
    scheduledDate: params.date,
    startsAt: params.startsAt,
    durationMinutes: params.durationMinutes,
    source: params.source,
    createdBy: params.createdBy,
  });
}

export async function cancelRealSession(supabase: TypedClient, id: string): Promise<void> {
  await deleteRealSessionRow(supabase, id);
}

function sessionMoment(session: RealSessionRow): number {
  return new Date(`${session.scheduled_date}T${session.starts_at}`).getTime();
}

/** Prochaine séance affichée dans la barre latérale joueuse (retour utilisateur) — la plus proche dans le futur ; une fois sa date passée, la requête retombe naturellement sur la suivante. */
export async function getNextSession(supabase: TypedClient, campaignId: string): Promise<RealSessionRow | null> {
  const sessions = await listRealSessions(supabase, campaignId);
  const now = Date.now();
  return sessions.find((s) => sessionMoment(s) >= now) ?? null;
}

/** Historique des parties jouées (retour utilisateur) — réservoir que le futur Livre de séance (V2.1-3) consultera pour "choisir une séance passée". */
export async function getPastSessions(supabase: TypedClient, campaignId: string): Promise<RealSessionRow[]> {
  const sessions = await listRealSessions(supabase, campaignId);
  const now = Date.now();
  return sessions.filter((s) => sessionMoment(s) < now).sort((a, b) => sessionMoment(b) - sessionMoment(a));
}

export async function getUpcomingSessions(supabase: TypedClient, campaignId: string): Promise<RealSessionRow[]> {
  const sessions = await listRealSessions(supabase, campaignId);
  const now = Date.now();
  return sessions.filter((s) => sessionMoment(s) >= now);
}

export async function setTargetSessionMinutes(supabase: TypedClient, campaignId: string, minutes: number): Promise<void> {
  await setTargetSessionMinutesRow(supabase, campaignId, minutes);
}

export { getTargetSessionMinutes, minutesToTime };
