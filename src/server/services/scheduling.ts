import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import {
  closeAvailabilityRequest as closeAvailabilityRequestRow,
  deleteAvailability as deleteAvailabilityRow,
  deleteRealSession as deleteRealSessionRow,
  getAvailabilityRequestById,
  getOpenAvailabilityRequest,
  getTargetSessionMinutes,
  insertAvailabilityRequest,
  insertRealSession,
  listAvailabilitiesForRequest,
  listAvailabilitiesForUserAndRequest,
  listRealSessions,
  setTargetSessionMinutes as setTargetSessionMinutesRow,
  upsertAvailability as upsertAvailabilityRow,
  type AvailabilityRequestRow,
  type AvailabilityRow,
  type RealSessionRow,
} from "@/src/server/repos/scheduling";
import { listCampaignMembers, listCampaignCharacters } from "@/src/server/repos/campaigns";
import { listEntitiesByIds } from "@/src/server/repos/entities";
import { classifySession, computeOverlap, rankDays, timeToMinutes, minutesToTime, type DayCandidate } from "@/src/core/scheduling/overlap";

type TypedClient = SupabaseClient<Database>;

export { deleteAvailabilityRow as deleteAvailability };
export type { AvailabilityRow, RealSessionRow, AvailabilityRequestRow };

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

function formatDateFr(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

export type OpenRequestResult = { ok: true; request: AvailabilityRequestRow } | { ok: false; reason: "already_open" };

/**
 * Ouvre une ronde de demande (V3.1-8) — titre généré si laissé vide (« Séance
 * du <première date candidate> »). L'unicité "une seule ouverte par
 * campagne" est portée par l'index partiel en base
 * (`availability_requests_one_open_per_campaign`) : cette fonction ne
 * revérifie rien avant d'écrire, elle capture juste le conflit si la
 * contrainte le déclenche (course-safe, plutôt qu'un aller-retour
 * lire-puis-écrire qui laisserait une fenêtre entre les deux).
 */
export async function openAvailabilityRequest(
  supabase: TypedClient,
  params: { campaignId: string; title: string | null; candidateDates: string[]; startsAt: string; endsAt: string; createdBy: string }
): Promise<OpenRequestResult> {
  const sortedDates = [...params.candidateDates].sort();
  const title = params.title?.trim() ? params.title.trim() : `Séance du ${formatDateFr(sortedDates[0])}`;
  try {
    const request = await insertAvailabilityRequest(supabase, {
      campaignId: params.campaignId,
      title,
      candidateDates: sortedDates,
      startsAt: params.startsAt,
      endsAt: params.endsAt,
      createdBy: params.createdBy,
    });
    return { ok: true, request };
  } catch (error) {
    if (error instanceof Error && /availability_requests_one_open_per_campaign/.test(error.message)) {
      return { ok: false, reason: "already_open" };
    }
    throw error;
  }
}

export async function getOpenRequest(supabase: TypedClient, campaignId: string): Promise<AvailabilityRequestRow | null> {
  return getOpenAvailabilityRequest(supabase, campaignId);
}

/** A-t-elle déjà répondu à cette ronde (V3.1-8, pastille) — au moins une date renseignée compte comme une réponse, pas besoin d'avoir couvert toutes les dates candidates. */
export async function hasRespondedToRequest(supabase: TypedClient, requestId: string, userId: string): Promise<boolean> {
  const rows = await listAvailabilitiesForUserAndRequest(supabase, requestId, userId);
  return rows.length > 0;
}

export async function getMyResponsesForRequest(supabase: TypedClient, requestId: string, userId: string): Promise<AvailabilityRow[]> {
  return listAvailabilitiesForUserAndRequest(supabase, requestId, userId);
}

export type RespondResult = { ok: true; availability: AvailabilityRow } | { ok: false; reason: "no_open_request" | "date_not_candidate" };

/**
 * Répond à la ronde ouverte d'une campagne (V3.1-8) — résout et valide la
 * ronde côté serveur (jamais un `requestId` transmis tel quel par le
 * client) : la date doit faire partie des dates candidates de la ronde
 * actuellement ouverte, sinon la joueuse répondrait à une question qui ne
 * lui a jamais été posée (ronde déjà fermée entre-temps, ou date hors
 * proposition).
 */
export async function respondToOpenRequest(
  supabase: TypedClient,
  params: { campaignId: string; userId: string; date: string; startsAt: string; endsAt: string }
): Promise<RespondResult> {
  const request = await getOpenAvailabilityRequest(supabase, params.campaignId);
  if (!request) return { ok: false, reason: "no_open_request" };
  if (!request.candidate_dates.includes(params.date)) return { ok: false, reason: "date_not_candidate" };

  const availability = await upsertAvailabilityRow(supabase, {
    campaignId: params.campaignId,
    userId: params.userId,
    date: params.date,
    startsAt: params.startsAt,
    endsAt: params.endsAt,
    requestId: request.id,
  });
  return { ok: true, availability };
}

/**
 * Classement des dates candidates d'une ronde de demande (V3.1-8) : croise
 * les réponses déjà déposées avec l'effectif réel de joueuses de la
 * campagne, calcule le chevauchement horaire de chaque date
 * (`src/core/scheduling/overlap.ts`, pur/testé) et renvoie les dates
 * triées du meilleur au moins bon, avec le détail par joueuse (roster
 * affiché au clic). Porte sur `request.candidate_dates` uniquement — une
 * date candidate sans aucune réponse apparaît quand même, classée en
 * dernier (`category: "none"`), pour que le MJ voie toute sa proposition,
 * pas seulement ce qui a déjà une réponse.
 */
export async function getRankedDaysForRequest(supabase: TypedClient, campaignId: string, request: AvailabilityRequestRow): Promise<RankedDay[]> {
  const [availabilities, members, targetMinutes, namesByUser] = await Promise.all([
    listAvailabilitiesForRequest(supabase, request.id),
    listCampaignMembers(supabase, campaignId),
    getTargetSessionMinutes(supabase, campaignId),
    resolvePlayerNames(supabase, campaignId),
  ]);
  const totalMembers = members.filter((m) => m.role === "player").length;

  const byDate = new Map<string, AvailabilityRow[]>();
  for (const date of request.candidate_dates) byDate.set(date, []);
  for (const row of availabilities) {
    const existing = byDate.get(row.date);
    if (existing) existing.push(row);
  }

  const days: RankedDay[] = [];
  for (const [date, rows] of byDate) {
    const overlap = computeOverlap(rows.map((r) => ({ userId: r.user_id, startsAt: timeToMinutes(r.starts_at), endsAt: timeToMinutes(r.ends_at) })));
    days.push({
      date,
      participantCount: rows.length,
      totalMembers,
      overlap: overlap ?? { start: 0, end: 0, durationMinutes: 0 },
      category: overlap ? classifySession(overlap.durationMinutes, targetMinutes) : "none",
      roster: rows.map((r) => ({ userId: r.user_id, name: namesByUser.get(r.user_id) ?? null, startsAt: r.starts_at, endsAt: r.ends_at })),
    });
  }
  return rankDays(days) as RankedDay[];
}

/** Confirme une séance, depuis le classement de disponibilités ou manuellement (retour utilisateur : "le MJ doit pouvoir mettre manuellement la prochaine date... sans passer par l'outil") — même écriture, `source` ne fait que changer l'étiquette affichée ensuite. Aucune limite au nombre de séances par mois (retour utilisateur). Ferme la ronde ouverte de la campagne s'il y en a une (V3.1-8, étape 6) : une séance confirmée répond à la question posée, la ronde n'a plus de raison de rester ouverte. */
export async function createRealSession(
  supabase: TypedClient,
  params: { campaignId: string; date: string; startsAt: string; durationMinutes: number; source: "availability" | "manual"; createdBy: string }
): Promise<RealSessionRow> {
  const session = await insertRealSession(supabase, {
    campaignId: params.campaignId,
    scheduledDate: params.date,
    startsAt: params.startsAt,
    durationMinutes: params.durationMinutes,
    source: params.source,
    createdBy: params.createdBy,
  });
  const openRequest = await getOpenAvailabilityRequest(supabase, params.campaignId);
  if (openRequest) await closeAvailabilityRequestRow(supabase, openRequest.id);
  return session;
}

/** Annule une ronde sans confirmer de séance (V3.1-8, « Annuler la demande ») — même fermeture que `createRealSession`, déclenchée explicitement par le MJ plutôt qu'en conséquence d'une confirmation. */
export async function cancelAvailabilityRequest(supabase: TypedClient, id: string): Promise<void> {
  await closeAvailabilityRequestRow(supabase, id);
}

export { getAvailabilityRequestById };

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
