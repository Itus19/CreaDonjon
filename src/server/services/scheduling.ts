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
import { classifySession, timeToMinutes, minutesToTime, type SessionCategory } from "@/src/core/scheduling/overlap";
import { buildHeatmap, generateSlots, type SlotResponse } from "@/src/core/scheduling/availabilityGrid";
import { bestWindowForDay, expectedAtTable, rankBestDays } from "@/src/core/scheduling/bestWindow";
import { getDisplayNamesForUsers } from "@/src/server/repos/activityJournal";

type TypedClient = SupabaseClient<Database>;

export { deleteAvailabilityRow as deleteAvailability };
export type { AvailabilityRow, RealSessionRow, AvailabilityRequestRow };

/**
 * Une date possible d'une ronde de demande (V3.1-16) : son meilleur créneau —
 * la plus longue plage où le plus de monde est présent (`bestWindowForDay`) —
 * et qui y est. `count`/`expected` font le décompte affiché (« 5/6 »).
 */
export interface RankedDay {
  date: string;
  count: number;
  expected: number;
  start: number;
  end: number;
  durationMinutes: number;
  category: SessionCategory;
  people: { userId: string; name: string }[];
  respondentCount: number;
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
 * Nom de chaque personne d'une campagne pour le Calendrier réel (V3.1-16) :
 * son nom de compte (`profiles.display_name`), jamais celui de son PJ — choix
 * de l'auteur le 1ᵉʳ octobre, pour cet écran seulement : `resolvePlayerNames`
 * (nom du PJ) reste ce qu'il est pour le Livre de sessions. Tous les MJ sont
 * nommés : l'ancienne version ne nommait que le premier, et l'autre
 * s'affichait « ? ».
 */
async function resolveSchedulingNames(supabase: TypedClient, userIds: string[]): Promise<Map<string, string>> {
  return getDisplayNamesForUsers(supabase, userIds);
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

const HEATMAP_STEP_MINUTES = 30;

export interface HeatmapCellWithNames {
  date: string;
  slotStart: number;
  users: { userId: string; name: string }[];
}
export interface Heatmap {
  slots: number[];
  step: number;
  cells: HeatmapCellWithNames[];
}

export interface RequestBoard {
  /** Seulement les jours où quelqu'un est disponible, du meilleur au moins bon. */
  days: RankedDay[];
  heatmap: Heatmap;
  /** Personnes attendues à la table — le dénominateur de chaque décompte. */
  expected: number;
}

/**
 * Tout ce que la grille et les dates possibles affichent pour une ronde de
 * demande (V3.1-16), en une seule lecture des réponses : la carte de chaleur
 * par demi-heure (`buildHeatmap`), puis, par jour, son meilleur créneau
 * (`bestWindowForDay`), classés (`rankBestDays`). Les réponses déjà déposées
 * sont lues telles quelles : rien ne change dans leur forme (une plage par
 * jour et par personne), seul le calcul du classement change.
 */
export async function getRequestBoard(supabase: TypedClient, campaignId: string, request: AvailabilityRequestRow): Promise<RequestBoard> {
  const [availabilities, members, targetMinutes] = await Promise.all([
    listAvailabilitiesForRequest(supabase, request.id),
    listCampaignMembers(supabase, campaignId),
    getTargetSessionMinutes(supabase, campaignId),
  ]);
  const expectedIds = expectedAtTable(members, request.created_by, availabilities.map((a) => a.user_id));
  const names = await resolveSchedulingNames(supabase, expectedIds);
  const nameOf = (userId: string) => names.get(userId) ?? "Sans nom";

  const slots = generateSlots(timeToMinutes(request.starts_at), timeToMinutes(request.ends_at), HEATMAP_STEP_MINUTES);
  const responses: SlotResponse[] = availabilities.map((r) => ({
    date: r.date,
    userId: r.user_id,
    startsAt: timeToMinutes(r.starts_at),
    endsAt: timeToMinutes(r.ends_at),
  }));
  const cells = buildHeatmap(request.candidate_dates, slots, HEATMAP_STEP_MINUTES, responses);

  const best = request.candidate_dates.map((date) => bestWindowForDay(date, cells, HEATMAP_STEP_MINUTES)).filter((d) => d !== null);
  const days: RankedDay[] = rankBestDays(best).map((d) => ({
    date: d.date,
    count: d.count,
    expected: expectedIds.length,
    start: d.start,
    end: d.end,
    durationMinutes: d.durationMinutes,
    category: classifySession(d.durationMinutes, targetMinutes),
    people: d.userIds.map((userId) => ({ userId, name: nameOf(userId) })),
    respondentCount: d.respondentCount,
  }));

  return {
    days,
    expected: expectedIds.length,
    heatmap: {
      slots,
      step: HEATMAP_STEP_MINUTES,
      cells: cells.map((c) => ({ date: c.date, slotStart: c.slotStart, users: c.userIds.map((userId) => ({ userId, name: nameOf(userId) })) })),
    },
  };
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
