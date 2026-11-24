import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import type { Locale } from "@/src/i18n/request";
import { resolveCheckRoll } from "@/src/core/rules/action";
import { parseTableSettings, showsRemotePlay, type CampaignTableSettings } from "@/src/core/campaigns/tableSettings";
import {
  buildRemoteFeed,
  remotePayload,
  rollCheckLabel,
  unreadCount,
  waitingList,
  zRollCheck,
  type RemoteFeedMessage,
  type RemoteMessageInput,
  type RollAnswerInput,
  type RollCheck,
  type RollRequestInput,
  type WaitingEntry,
} from "@/src/core/remote/feed";
import type { BonusDie } from "@/src/core/rules/sheet";
import { getCampaignTableSettingsRaw, listCampaignCharacters, listCampaignMembers } from "@/src/server/repos/campaigns";
import { getDisplayNamesForUsers } from "@/src/server/repos/activityJournal";
import { insertSessionEvent, nextEventSeq } from "@/src/server/repos/sessions";
import {
  answerRollRequestRow,
  cancelRollRequest,
  getEntityNames,
  getRollRequest,
  getSessionReadSeq,
  insertRollRequest,
  insertRollRequestHiddenDc,
  listHiddenDcs,
  listRemoteEvents,
  listRollRequests,
  setRollRequestEvent,
  upsertSessionRead,
  type RollRequestRow,
} from "@/src/server/repos/remotePlay";
import { getCampaign } from "@/src/server/services/campaigns";
import { resolveCharacterActionContext } from "@/src/server/services/characterActions";
import { isWorldAdmin } from "@/src/server/services/permissions";
import { serverRng } from "@/src/server/services/rng";
import { getOrOpenSessionForCampaign } from "@/src/server/services/sessions";

type TypedClient = SupabaseClient<Database>;

/**
 * Le jeu à distance (ADR 0103) : ce que l'écran du MJ et celui d'un joueur
 * lisent, et les trois gestes (écrire, demander un jet, y répondre).
 *
 * Le fil vit dans le journal de la session ouverte de la campagne
 * (`getOrOpenSessionForCampaign`, comme les gestes de fiche). La RLS a déjà
 * retiré les secrets qui ne sont pas pour l'appelant ; le DD caché n'est lu
 * que pour le MJ.
 */

export interface RemotePlayer {
  userId: string;
  name: string;
  entityId: string | null;
}

export interface RemoteRollRequestView {
  id: string;
  targetUserId: string;
  targetName: string;
  label: string;
  advantage: string;
  /** Le DD annoncé aux joueurs, ou nul. */
  dcShown: number | null;
  /** Le DD caché : rempli pour le MJ seul. */
  dcHidden: number | null;
  /** Le bonus de la fiche de la cible, pour sa carte (« +7 »). Rempli pour la cible seule. */
  bonus: number | null;
  status: string;
  natural: number | null;
  total: number | null;
  byHand: boolean | null;
}

export interface RemoteTableView {
  campaignId: string;
  sessionId: string;
  viewerId: string;
  isGm: boolean;
  players: RemotePlayer[];
  feed: RemoteFeedMessage[];
  requests: RemoteRollRequestView[];
  waiting: WaitingEntry[];
  lastReadSeq: number | null;
  unread: number;
}

export type RemoteError = "not_found" | "forbidden" | "not_remote" | "invalid_target" | "refused" | "no_sheet";

interface Table {
  campaignId: string;
  worldId: string;
  sessionId: string;
  isGm: boolean;
  players: RemotePlayer[];
  names: Record<string, string>;
}

/** La campagne, son mode, l'appelant et les joueurs : une vague pour les lectures indépendantes (C3). */
async function loadTable(supabase: TypedClient, params: { campaignId: string; userId: string }): Promise<{ ok: true; table: Table; settings: CampaignTableSettings } | { ok: false; reason: RemoteError }> {
  const [campaign, rawSettings, members, characters] = await Promise.all([
    getCampaign(supabase, params.campaignId),
    getCampaignTableSettingsRaw(supabase, params.campaignId),
    listCampaignMembers(supabase, params.campaignId),
    listCampaignCharacters(supabase, params.campaignId),
  ]);
  if (!campaign || rawSettings === undefined) return { ok: false, reason: "not_found" };
  const settings = parseTableSettings(rawSettings);
  if (!showsRemotePlay(settings)) return { ok: false, reason: "not_remote" };

  const playerIds = members.filter((m) => m.role === "player").map((m) => m.user_id);
  const pcOf = new Map(characters.filter((c) => c.is_pc && c.user_id).map((c) => [c.user_id as string, c.entity_id]));
  const [isGm, entityNames, displayNames, sessionId] = await Promise.all([
    isWorldAdmin(supabase, { worldId: campaign.worldId, userId: params.userId }),
    getEntityNames(supabase, [...pcOf.values()]),
    getDisplayNamesForUsers(supabase, playerIds),
    getOrOpenSessionForCampaign(supabase, params.campaignId),
  ]);
  if (!isGm && !playerIds.includes(params.userId)) return { ok: false, reason: "forbidden" };

  const players: RemotePlayer[] = playerIds.map((userId) => {
    const entityId = pcOf.get(userId) ?? null;
    const name = (entityId ? entityNames.get(entityId) : undefined) ?? displayNames.get(userId) ?? "Joueur";
    return { userId, name, entityId };
  });
  const names = Object.fromEntries(players.map((p) => [p.userId, p.name]));
  return { ok: true, table: { campaignId: params.campaignId, worldId: campaign.worldId, sessionId, isGm, players, names }, settings };
}

function bonusFor(check: RollCheck, sheet: { skills: Record<string, { mod: number; dice?: readonly BonusDie[] }>; abilityChecks: Record<string, { mod: number; dice?: readonly BonusDie[] }>; savingThrows: Record<string, { mod: number; dice?: readonly BonusDie[] }> }): { mod: number; dice: readonly BonusDie[] } {
  const r = check.kind === "skill" ? sheet.skills[check.key] : check.kind === "ability" ? sheet.abilityChecks[check.key] : sheet.savingThrows[check.key];
  return { mod: r?.mod ?? 0, dice: r?.dice ?? [] };
}

function checkOf(row: RollRequestRow): RollCheck | null {
  const parsed = zRollCheck.safeParse({ kind: row.check_kind, key: row.check_key });
  return parsed.success ? parsed.data : null;
}

export async function loadRemoteTable(
  supabase: TypedClient,
  params: { campaignId: string; userId: string; locale: Locale }
): Promise<{ ok: true; view: RemoteTableView } | { ok: false; reason: RemoteError }> {
  const loaded = await loadTable(supabase, params);
  if (!loaded.ok) return loaded;
  const { table } = loaded;

  const [events, requestRows, lastReadSeq] = await Promise.all([
    listRemoteEvents(supabase, table.sessionId),
    listRollRequests(supabase, table.sessionId),
    getSessionReadSeq(supabase, { sessionId: table.sessionId, userId: params.userId }),
  ]);

  // Le bonus d'une demande en cours, pour la carte de SA cible seulement ; le DD caché, pour le MJ seulement.
  const mine = requestRows.find((r) => r.status === "pending" && r.target_user_id === params.userId && r.target_entity_id);
  const [hiddenDcs, ctx] = await Promise.all([
    table.isGm ? listHiddenDcs(supabase, requestRows.map((r) => r.id)) : Promise.resolve(new Map<string, number>()),
    mine?.target_entity_id ? resolveCharacterActionContext(supabase, mine.target_entity_id, table.campaignId, params.locale) : Promise.resolve(null),
  ]);

  const feed = buildRemoteFeed(
    events.map((e) => ({ id: e.id, seq: e.seq, kind: e.kind, actor: e.actor, actorUserId: e.actor_user_id, payload: e.payload, visibleTo: e.visible_to, createdAt: e.created_at })),
    { viewerId: params.userId, names: table.names }
  );
  const requests: RemoteRollRequestView[] = requestRows.map((r) => {
    const check = checkOf(r);
    return {
      id: r.id,
      targetUserId: r.target_user_id,
      targetName: table.names[r.target_user_id] ?? "Joueur",
      label: r.label,
      advantage: r.advantage,
      dcShown: r.dc_shown,
      dcHidden: hiddenDcs.get(r.id) ?? null,
      bonus: mine && r.id === mine.id && ctx && check ? bonusFor(check, ctx.sheet).mod : null,
      status: r.status,
      natural: r.natural_roll,
      total: r.total,
      byHand: r.by_hand,
    };
  });
  const waiting = waitingList(
    feed,
    requestRows.map((r) => ({ id: r.id, targetUserId: r.target_user_id, label: r.label, status: r.status === "pending" ? "pending" : r.status === "answered" ? "answered" : "cancelled" })),
    table.names
  );

  return {
    ok: true,
    view: {
      campaignId: table.campaignId,
      sessionId: table.sessionId,
      viewerId: params.userId,
      isGm: table.isGm,
      players: table.players,
      feed,
      requests,
      waiting,
      lastReadSeq,
      unread: unreadCount(feed, lastReadSeq),
    },
  };
}

/** Écrire dans le fil. Un joueur ne restreint qu'au MJ ; le MJ, à des joueurs de la table. */
export async function postRemoteMessage(
  supabase: TypedClient,
  params: { campaignId: string; userId: string; input: RemoteMessageInput }
): Promise<{ ok: true; seq: number } | { ok: false; reason: RemoteError }> {
  const loaded = await loadTable(supabase, params);
  if (!loaded.ok) return loaded;
  const { table } = loaded;
  const { input } = params;
  const playerIds = new Set(table.players.map((p) => p.userId));

  if (table.isGm) {
    // Une liste vide, chez le MJ, ne serait lue que de lui : refusée plutôt que publiée par erreur.
    if (input.visibleTo !== null && (input.visibleTo.length === 0 || input.visibleTo.some((id) => !playerIds.has(id)))) return { ok: false, reason: "invalid_target" };
    if (input.awaiting?.some((id) => !playerIds.has(id))) return { ok: false, reason: "invalid_target" };
  } else {
    if (input.visibleTo !== null && input.visibleTo.length > 0) return { ok: false, reason: "invalid_target" };
    if (input.awaiting && input.awaiting.length > 0) return { ok: false, reason: "invalid_target" };
  }

  const seq = await nextEventSeq(supabase, table.sessionId);
  await insertSessionEvent(supabase, {
    sessionId: table.sessionId,
    seq,
    kind: table.isGm ? "narration" : "player_action",
    actor: table.isGm ? "gm" : "player",
    actorUserId: params.userId,
    payload: remotePayload({ text: input.text, awaiting: table.isGm ? input.awaiting : undefined }) as Json,
    visibleTo: input.visibleTo,
  });
  return { ok: true, seq };
}

/** Le MJ demande un jet à un joueur : la demande, son DD caché à part, puis le message qui la porte. */
export async function requestRemoteRoll(
  supabase: TypedClient,
  params: { campaignId: string; userId: string; input: RollRequestInput }
): Promise<{ ok: true; requestId: string } | { ok: false; reason: RemoteError }> {
  const loaded = await loadTable(supabase, params);
  if (!loaded.ok) return loaded;
  const { table } = loaded;
  if (!table.isGm) return { ok: false, reason: "forbidden" };
  const target = table.players.find((p) => p.userId === params.input.targetUserId);
  if (!target) return { ok: false, reason: "invalid_target" };

  const { input } = params;
  const label = rollCheckLabel(input.check);
  const request = await insertRollRequest(supabase, {
    campaignId: table.campaignId,
    sessionId: table.sessionId,
    authorUserId: params.userId,
    targetUserId: target.userId,
    targetEntityId: target.entityId,
    checkKind: input.check.kind,
    checkKey: input.check.key,
    label,
    advantage: input.advantage,
    dcShown: input.dc !== null && !input.dcHidden ? input.dc : null,
  });
  if (input.dc !== null && input.dcHidden) await insertRollRequestHiddenDc(supabase, { requestId: request.id, dc: input.dc });

  const seq = await nextEventSeq(supabase, table.sessionId);
  const text = input.text && input.text.length > 0 ? input.text : `${target.name}, fais un jet : ${label}.`;
  const event = await insertSessionEvent(supabase, {
    sessionId: table.sessionId,
    seq,
    kind: "narration",
    actor: "gm",
    actorUserId: params.userId,
    payload: remotePayload({ text, rollRequestId: request.id }) as Json,
  });
  await setRollRequestEvent(supabase, { requestId: request.id, eventId: event.id });
  return { ok: true, requestId: request.id };
}

export async function cancelRemoteRoll(
  supabase: TypedClient,
  params: { campaignId: string; userId: string; requestId: string }
): Promise<{ ok: true } | { ok: false; reason: RemoteError }> {
  const loaded = await loadTable(supabase, params);
  if (!loaded.ok) return loaded;
  if (!loaded.table.isGm) return { ok: false, reason: "forbidden" };
  const request = await getRollRequest(supabase, params.requestId);
  if (!request || request.campaign_id !== params.campaignId) return { ok: false, reason: "not_found" };
  return (await cancelRollRequest(supabase, params.requestId)) ? { ok: true } : { ok: false, reason: "refused" };
}

/**
 * La joueuse visée répond : le serveur lance le d20 (règle 8), ou recopie
 * son dé physique ; le bonus vient de SA fiche, recalculée ici (règle 16).
 * La fonction de la base tranche d'abord (bon compte, une seule fois) ; le
 * message de réponse ne s'écrit qu'ensuite.
 */
export async function answerRemoteRoll(
  supabase: TypedClient,
  params: { campaignId: string; userId: string; requestId: string; input: RollAnswerInput; locale: Locale }
): Promise<{ ok: true; natural: number; total: number } | { ok: false; reason: RemoteError }> {
  const loaded = await loadTable(supabase, params);
  if (!loaded.ok) return loaded;
  const { table } = loaded;
  const request = await getRollRequest(supabase, params.requestId);
  if (!request || request.campaign_id !== params.campaignId) return { ok: false, reason: "not_found" };
  if (request.target_user_id !== params.userId || request.status !== "pending") return { ok: false, reason: "refused" };
  const check = checkOf(request);
  if (!check || !request.target_entity_id) return { ok: false, reason: "no_sheet" };

  const ctx = await resolveCharacterActionContext(supabase, request.target_entity_id, table.campaignId, params.locale);
  if (!ctx) return { ok: false, reason: "no_sheet" };
  const { mod, dice } = bonusFor(check, ctx.sheet);

  let natural: number;
  let total: number;
  if (params.input.mode === "roll") {
    const advantage = request.advantage === "advantage" ? "advantage" : request.advantage === "disadvantage" ? "disadvantage" : "normal";
    const roll = resolveCheckRoll({ modifier: mod, advantage, bonusDice: dice }, serverRng);
    natural = roll.trace[0]?.value ?? 1;
    total = roll.total;
  } else {
    natural = params.input.natural;
    total = natural + mod;
  }
  const byHand = params.input.mode === "by_hand";

  const answered = await answerRollRequestRow(supabase, { requestId: request.id, natural, total, byHand, answerEventId: null });
  if (!answered) return { ok: false, reason: "refused" };

  const seq = await nextEventSeq(supabase, table.sessionId);
  await insertSessionEvent(supabase, {
    sessionId: table.sessionId,
    seq,
    kind: "roll",
    actor: "player",
    actorUserId: params.userId,
    payload: remotePayload({ text: "", roll: { requestId: request.id, label: request.label, natural, total, byHand } }) as Json,
  });
  return { ok: true, natural, total };
}

/** Note le dernier message lu (jamais en arrière). */
export async function markRemoteRead(
  supabase: TypedClient,
  params: { campaignId: string; userId: string; seq: number }
): Promise<{ ok: true } | { ok: false; reason: RemoteError }> {
  const loaded = await loadTable(supabase, params);
  if (!loaded.ok) return loaded;
  const current = await getSessionReadSeq(supabase, { sessionId: loaded.table.sessionId, userId: params.userId });
  if (current !== null && current >= params.seq) return { ok: true };
  await upsertSessionRead(supabase, { sessionId: loaded.table.sessionId, userId: params.userId, lastSeq: params.seq });
  return { ok: true };
}
