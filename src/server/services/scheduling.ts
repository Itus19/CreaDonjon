import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import {
  closeAvailabilityRequest as closeAvailabilityRequestRow,
  deleteAvailabilitiesForUserAndRequest,
  deleteAvailability as deleteAvailabilityRow,
  deleteDecline,
  deleteRealSession as deleteRealSessionRow,
  getAvailabilityRequestById,
  getTargetSessionMinutes,
  insertAvailabilityRequest,
  insertRealSession,
  listAvailabilitiesForRequest,
  listAvailabilitiesForUserAndRequest,
  listDeclinesForRequests,
  listOpenAvailabilityRequests,
  listRealSessions,
  listRespondentsForRequests,
  upsertDecline,
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
import { bestWindowForDay, rankBestDays } from "@/src/core/scheduling/bestWindow";
import { summarizeRequest, unansweredCount, type RequestSummary } from "@/src/core/scheduling/requestStatus";
import { getDisplayNamesForUsers } from "@/src/server/repos/activityJournal";

type TypedClient = SupabaseClient<Database>;

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

/**
 * Ouvre une demande (V3.1-8) — titre généré si laissé vide (« Séance du
 * <première date candidate> »). V3.1-190 : plusieurs demandes peuvent être
 * ouvertes en même temps ; la RLS réserve l'écriture au MJ du monde.
 */
export async function openAvailabilityRequest(
  supabase: TypedClient,
  params: { campaignId: string; title: string | null; candidateDates: string[]; startsAt: string; endsAt: string; createdBy: string }
): Promise<AvailabilityRequestRow> {
  const sortedDates = [...params.candidateDates].sort();
  const title = params.title?.trim() ? params.title.trim() : `Séance du ${formatDateFr(sortedDates[0])}`;
  return insertAvailabilityRequest(supabase, {
    campaignId: params.campaignId,
    title,
    candidateDates: sortedDates,
    startsAt: params.startsAt,
    endsAt: params.endsAt,
    createdBy: params.createdBy,
  });
}

/**
 * La demande visée, si elle est ouverte ET appartient à cette campagne — la
 * seule porte des gestes d'une joueuse (répondre, effacer, « aucune date ») :
 * jamais un `requestId` du client pris tel quel.
 */
async function openRequestOfCampaign(supabase: TypedClient, campaignId: string, requestId: string): Promise<AvailabilityRequestRow | null> {
  const request = await getAvailabilityRequestById(supabase, requestId);
  return request && request.campaign_id === campaignId && request.status === "open" ? request : null;
}

export type RespondResult = { ok: true; availability: AvailabilityRow } | { ok: false; reason: "no_open_request" | "date_not_candidate" };

/**
 * Répond à une demande ouverte (V3.1-8, V3.1-190) : la date doit faire partie
 * de ses dates candidates. Cocher une date retire un « aucune date ne me va »
 * posé avant.
 */
export async function respondToRequest(
  supabase: TypedClient,
  params: { campaignId: string; requestId: string; userId: string; date: string; startsAt: string; endsAt: string }
): Promise<RespondResult> {
  const request = await openRequestOfCampaign(supabase, params.campaignId, params.requestId);
  if (!request) return { ok: false, reason: "no_open_request" };
  if (!request.candidate_dates.includes(params.date)) return { ok: false, reason: "date_not_candidate" };

  const [availability] = await Promise.all([
    upsertAvailabilityRow(supabase, {
      campaignId: params.campaignId,
      userId: params.userId,
      date: params.date,
      startsAt: params.startsAt,
      endsAt: params.endsAt,
      requestId: request.id,
    }),
    deleteDecline(supabase, { requestId: request.id, userId: params.userId }),
  ]);
  return { ok: true, availability };
}

/** Efface une date cochée pour une demande ouverte de cette campagne. */
export async function clearAvailability(
  supabase: TypedClient,
  params: { campaignId: string; requestId: string; userId: string; date: string }
): Promise<boolean> {
  const request = await openRequestOfCampaign(supabase, params.campaignId, params.requestId);
  if (!request) return false;
  await deleteAvailabilityRow(supabase, { requestId: request.id, userId: params.userId, date: params.date });
  return true;
}

/**
 * V3.1-190 — « Aucune date ne me va » : efface les dates cochées pour cette
 * demande et note la réponse, pour que la joueuse compte comme ayant répondu.
 */
export async function declineRequest(supabase: TypedClient, params: { campaignId: string; requestId: string; userId: string }): Promise<boolean> {
  const request = await openRequestOfCampaign(supabase, params.campaignId, params.requestId);
  if (!request) return false;
  await deleteAvailabilitiesForUserAndRequest(supabase, { requestId: request.id, userId: params.userId });
  await upsertDecline(supabase, { requestId: request.id, campaignId: params.campaignId, userId: params.userId });
  return true;
}

interface OpenRequestsState {
  requests: AvailabilityRequestRow[];
  members: Awaited<ReturnType<typeof listCampaignMembers>>;
  summaries: Map<string, RequestSummary>;
  declinedBy: Map<string, Set<string>>;
}

/**
 * V3.1-190 — les demandes ouvertes et leur état, en quatre lectures au plus
 * quelle que soit leur nombre : demandes, membres, puis qui a coché et qui a
 * décliné pour toutes à la fois (`in`). Sert l'écran et les deux pastilles.
 */
async function loadOpenRequestsState(supabase: TypedClient, campaignId: string): Promise<OpenRequestsState> {
  const [requests, members] = await Promise.all([listOpenAvailabilityRequests(supabase, campaignId), listCampaignMembers(supabase, campaignId)]);
  const ids = requests.map((r) => r.id);
  const [respondents, declines] = await Promise.all([listRespondentsForRequests(supabase, ids), listDeclinesForRequests(supabase, ids)]);
  const summaries = new Map<string, RequestSummary>();
  const declinedBy = new Map<string, Set<string>>();
  for (const request of requests) {
    const declined = declines.filter((d) => d.request_id === request.id).map((d) => d.user_id);
    declinedBy.set(request.id, new Set(declined));
    summaries.set(
      request.id,
      summarizeRequest({
        members,
        creatorId: request.created_by,
        availabilityUserIds: respondents.filter((r) => r.request_id === request.id).map((r) => r.user_id),
        declinedUserIds: declined,
      })
    );
  }
  return { requests, members, summaries, declinedBy };
}

/** V3.1-190 — la pastille du rail joueur : les demandes ouvertes qui attendent sa réponse. */
export async function countUnansweredRequests(supabase: TypedClient, campaignId: string, userId: string): Promise<number> {
  const { summaries } = await loadOpenRequestsState(supabase, campaignId);
  return unansweredCount([...summaries.values()], userId);
}

/** V3.1-190 — la pastille MJ « N à fixer » : les demandes ouvertes où tout le monde a répondu. */
export async function countRequestsReadyToFix(supabase: TypedClient, campaignId: string): Promise<number> {
  const { summaries } = await loadOpenRequestsState(supabase, campaignId);
  return [...summaries.values()].filter((s) => s.ready).length;
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
 * Tout ce que la grille et les dates possibles affichent pour une demande
 * (V3.1-16), à partir de ses réponses : la carte de chaleur par demi-heure
 * (`buildHeatmap`), puis, par jour, son meilleur créneau
 * (`bestWindowForDay`), classés (`rankBestDays`).
 */
function buildRequestBoard(
  request: AvailabilityRequestRow,
  availabilities: AvailabilityRow[],
  expectedIds: string[],
  nameOf: (userId: string) => string,
  targetMinutes: number
): RequestBoard {
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

/** Une carte de la rangée « Demandes en cours » (MJ) / « Demandes du MJ » (joueur). */
export interface RequestCard {
  id: string;
  title: string;
  candidateCount: number;
  startsAt: string;
  endsAt: string;
  respondedCount: number;
  expectedCount: number;
  missingNames: string[];
  ready: boolean;
  viewerResponded: boolean;
}

export interface SchedulingBoard {
  requests: RequestCard[];
  /** La demande affichée : celle demandée si elle est ouverte, sinon la plus ancienne ; `null` sans demande. */
  request: AvailabilityRequestRow | null;
  days: RankedDay[];
  heatmap: Heatmap | null;
  expected: number;
  /** Qui a répondu à la demande affichée (la ligne « Réponses » du MJ). */
  responses: { userId: string; name: string; responded: boolean }[];
  myResponses: AvailabilityRow[];
  /** Ce compte a dit « aucune date ne me va » pour la demande affichée. */
  declined: boolean;
  viewerId: string;
  targetMinutes: number;
}

/**
 * V3.1-190 — tout l'écran Calendrier réel (MJ) et Prochaine session
 * (joueur), en une fois : les cartes de toutes les demandes ouvertes, puis,
 * pour la demande affichée, la grille, les dates possibles, qui a répondu et
 * mes propres réponses. Deux vagues de lectures, puis une troisième pour la
 * demande affichée (ses plages, les noms, la durée visée).
 */
export async function getSchedulingBoard(
  supabase: TypedClient,
  params: { campaignId: string; userId: string; requestId: string | null }
): Promise<SchedulingBoard> {
  const state = await loadOpenRequestsState(supabase, params.campaignId);
  const selected = state.requests.find((r) => r.id === params.requestId) ?? state.requests[0] ?? null;

  const everyone = [...new Set([...state.summaries.values()].flatMap((s) => s.expected))];
  const [names, targetMinutes, availabilities] = await Promise.all([
    resolveSchedulingNames(supabase, everyone),
    getTargetSessionMinutes(supabase, params.campaignId),
    selected ? listAvailabilitiesForRequest(supabase, selected.id) : Promise.resolve([] as AvailabilityRow[]),
  ]);
  const nameOf = (userId: string) => names.get(userId) ?? "Sans nom";

  const requests: RequestCard[] = state.requests.map((r) => {
    const summary = state.summaries.get(r.id)!;
    return {
      id: r.id,
      title: r.title,
      candidateCount: r.candidate_dates.length,
      startsAt: r.starts_at,
      endsAt: r.ends_at,
      respondedCount: summary.responded.length,
      expectedCount: summary.expected.length,
      missingNames: summary.missing.map(nameOf),
      ready: summary.ready,
      viewerResponded: summary.responded.includes(params.userId),
    };
  });

  if (!selected) {
    return { requests, request: null, days: [], heatmap: null, expected: 0, responses: [], myResponses: [], declined: false, viewerId: params.userId, targetMinutes };
  }

  const summary = state.summaries.get(selected.id)!;
  const board = buildRequestBoard(selected, availabilities, summary.expected, nameOf, targetMinutes);
  return {
    requests,
    request: selected,
    ...board,
    responses: summary.expected.map((userId) => ({ userId, name: nameOf(userId), responded: summary.responded.includes(userId) })),
    myResponses: availabilities.filter((a) => a.user_id === params.userId),
    declined: state.declinedBy.get(selected.id)?.has(params.userId) ?? false,
    viewerId: params.userId,
    targetMinutes,
  };
}

/** Confirme une séance, depuis le classement de disponibilités ou manuellement (retour utilisateur : "le MJ doit pouvoir mettre manuellement la prochaine date... sans passer par l'outil") — même écriture, `source` ne fait que changer l'étiquette affichée ensuite. Aucune limite au nombre de séances par mois (retour utilisateur). Ferme **la demande dont la date est fixée** (`requestId`), seulement pour une séance confirmée depuis les disponibilités (V3.1-8, étape 6) ; les autres demandes restent ouvertes (V3.1-190). Une date réglée à la main ne ferme rien (bug rapporté le 1ᵉʳ octobre, V3.1-16). */
export async function createRealSession(
  supabase: TypedClient,
  params: { campaignId: string; date: string; startsAt: string; durationMinutes: number; source: "availability" | "manual"; createdBy: string; requestId?: string | null }
): Promise<RealSessionRow> {
  const session = await insertRealSession(supabase, {
    campaignId: params.campaignId,
    scheduledDate: params.date,
    startsAt: params.startsAt,
    durationMinutes: params.durationMinutes,
    source: params.source,
    createdBy: params.createdBy,
  });
  if (params.source === "availability" && params.requestId) {
    const request = await openRequestOfCampaign(supabase, params.campaignId, params.requestId);
    if (request) await closeAvailabilityRequestRow(supabase, request.id);
  }
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

/** Toutes les séances réelles, dans l'ordre (V3.1-43) : le Livre de sessions y retrouve la séance réelle de chaque devoir et propose la dernière jouée ; l'écran sépare passé et futur. */
export async function listCampaignRealSessions(supabase: TypedClient, campaignId: string): Promise<RealSessionRow[]> {
  return listRealSessions(supabase, campaignId);
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
