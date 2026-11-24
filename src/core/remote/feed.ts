import { z } from "zod";
import { ABILITIES, ABILITY_LABELS, SKILLS, type Ability, type Skill } from "../rules/abilities";
import { SKILL_LABELS_FR } from "../../i18n/fr";

/**
 * Le jeu à distance (ADR 0103) : le fil commun d'un MJ humain et de ses
 * joueurs, lu dans le journal de session. Module pur : il reçoit les
 * événements déjà filtrés par la RLS (un secret n'arrive ici que chez ses
 * lecteurs) et les met en forme, compte les non-lus et dit qui doit répondre.
 */

/** La façon de jouer d'une campagne : ce qu'elle montre, jamais ce qu'elle garde. */
export const zPlayStyle = z.enum(["table", "remote", "both"]);
export type PlayStyle = z.infer<typeof zPlayStyle>;

/** Le canal qui distingue un message du jeu à distance des autres événements du journal (moteur, solo). */
export const REMOTE_CHANNEL = "distance";

export const REMOTE_TEXT_MAX = 4000;

/** Un message envoyé par le MJ ou un joueur. `visibleTo` : nul = tous, liste = ces joueurs, vide = le MJ seul. */
export const zRemoteMessageInput = z
  .object({
    text: z.string().trim().min(1).max(REMOTE_TEXT_MAX),
    visibleTo: z.array(z.string().uuid()).max(12).nullable(),
    /** Le MJ seul : les joueurs dont il attend la réponse. */
    awaiting: z.array(z.string().uuid()).max(12).optional(),
  })
  .strict();
export type RemoteMessageInput = z.infer<typeof zRemoteMessageInput>;

export const zRollCheck = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("skill"), key: z.enum(SKILLS as [Skill, ...Skill[]]) }).strict(),
  z.object({ kind: z.literal("ability"), key: z.enum(ABILITIES as [Ability, ...Ability[]]) }).strict(),
  z.object({ kind: z.literal("save"), key: z.enum(ABILITIES as [Ability, ...Ability[]]) }).strict(),
]);
export type RollCheck = z.infer<typeof zRollCheck>;

export const zRollAdvantage = z.enum(["none", "advantage", "disadvantage"]);
export type RollAdvantage = z.infer<typeof zRollAdvantage>;

/** Une demande de jet du MJ. Le DD est facultatif ; caché, il ne quitte jamais le serveur du MJ. */
export const zRollRequestInput = z
  .object({
    targetUserId: z.string().uuid(),
    check: zRollCheck,
    advantage: zRollAdvantage,
    dc: z.number().int().min(1).max(40).nullable(),
    dcHidden: z.boolean(),
    /** Le texte du message qui porte la demande (« Tu prends ton élan… »), facultatif. */
    text: z.string().trim().max(REMOTE_TEXT_MAX).optional(),
  })
  .strict();
export type RollRequestInput = z.infer<typeof zRollRequestInput>;

/** La réponse du joueur : un jet du serveur, ou le dé physique recopié. */
export const zRollAnswerInput = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("roll") }).strict(),
  z.object({ mode: z.literal("by_hand"), natural: z.number().int().min(1).max(20) }).strict(),
]);
export type RollAnswerInput = z.infer<typeof zRollAnswerInput>;

export function rollCheckLabel(check: RollCheck): string {
  if (check.kind === "skill") return SKILL_LABELS_FR[check.key];
  if (check.kind === "ability") return ABILITY_LABELS[check.key];
  return `Sauvegarde de ${ABILITY_LABELS[check.key]}`;
}

/** Un événement du journal tel que la base le rend au lecteur (après RLS). */
export interface RemoteEvent {
  id: string;
  seq: number;
  kind: string;
  actor: string;
  actorUserId: string | null;
  payload: unknown;
  visibleTo: string[] | null;
  createdAt: string;
}

export interface RemoteRollResult {
  requestId: string;
  label: string;
  natural: number;
  total: number;
  byHand: boolean;
}

export type RemoteSecret = { kind: "players"; names: string[] } | { kind: "gm_only" };

export interface RemoteFeedMessage {
  id: string;
  seq: number;
  voice: "gm" | "player";
  authorUserId: string | null;
  authorName: string;
  mine: boolean;
  text: string;
  secret: RemoteSecret | null;
  awaiting: string[];
  /** La demande de jet que ce message porte, s'il en porte une. */
  rollRequestId: string | null;
  roll: RemoteRollResult | null;
  createdAt: string;
}

const zStoredPayload = z.object({
  channel: z.literal(REMOTE_CHANNEL),
  text: z.string(),
  awaiting: z.array(z.string()).optional(),
  rollRequestId: z.string().optional(),
  roll: z
    .object({ requestId: z.string(), label: z.string(), natural: z.number(), total: z.number(), byHand: z.boolean() })
    .optional(),
});

/** Le payload d'un message écrit par le serveur, à la forme que `buildRemoteFeed` relit. */
export function remotePayload(fields: { text: string; awaiting?: string[]; rollRequestId?: string; roll?: RemoteRollResult }): Record<string, unknown> {
  return {
    channel: REMOTE_CHANNEL,
    text: fields.text,
    ...(fields.awaiting && fields.awaiting.length > 0 ? { awaiting: fields.awaiting } : {}),
    ...(fields.rollRequestId ? { rollRequestId: fields.rollRequestId } : {}),
    ...(fields.roll ? { roll: fields.roll } : {}),
  };
}

export function buildRemoteFeed(events: readonly RemoteEvent[], ctx: { viewerId: string; names: Record<string, string> }): RemoteFeedMessage[] {
  const nom = (id: string | null) => (id ? (ctx.names[id] ?? "Joueur") : "Joueur");
  return [...events]
    .sort((a, b) => a.seq - b.seq)
    .flatMap((e): RemoteFeedMessage[] => {
      const parsed = zStoredPayload.safeParse(e.payload);
      if (!parsed.success) return [];
      const voice = e.actor === "gm" ? "gm" : e.actor === "player" ? "player" : null;
      if (!voice) return [];
      const p = parsed.data;
      const secret: RemoteSecret | null =
        e.visibleTo === null ? null : e.visibleTo.length === 0 ? { kind: "gm_only" } : { kind: "players", names: e.visibleTo.map((id) => nom(id)) };
      return [
        {
          id: e.id,
          seq: e.seq,
          voice,
          authorUserId: e.actorUserId,
          authorName: voice === "gm" ? "MJ" : nom(e.actorUserId),
          mine: e.actorUserId === ctx.viewerId,
          text: p.text,
          secret,
          awaiting: p.awaiting ?? [],
          rollRequestId: p.rollRequestId ?? null,
          roll: p.roll ?? null,
          createdAt: e.createdAt,
        },
      ];
    });
}

export interface RemoteRollRequest {
  id: string;
  targetUserId: string;
  label: string;
  status: "pending" | "answered" | "cancelled";
}

export type WaitingReason = "waits_for_gm" | "must_reply" | "must_roll";
export interface WaitingEntry {
  userId: string;
  name: string;
  reason: WaitingReason;
}

/**
 * Qui doit répondre, déduit du fil (jamais stocké, règle 16) :
 * - un joueur qui a écrit après le dernier mot du MJ ATTEND le MJ ;
 * - un joueur que le dernier message du MJ attend, et qui n'a pas écrit depuis, doit RÉPONDRE ;
 * - une demande de jet en cours fait LANCER (elle prime sur le reste pour ce joueur).
 */
export function waitingList(feed: readonly RemoteFeedMessage[], requests: readonly RemoteRollRequest[], names: Record<string, string>): WaitingEntry[] {
  const lastGm = [...feed].reverse().find((m) => m.voice === "gm");
  const lastGmSeq = lastGm?.seq ?? 0;
  const entries = new Map<string, WaitingReason>();

  for (const m of feed) {
    if (m.voice === "player" && m.authorUserId && m.seq > lastGmSeq) entries.set(m.authorUserId, "waits_for_gm");
  }
  for (const id of lastGm?.awaiting ?? []) {
    if (!entries.has(id)) entries.set(id, "must_reply");
  }
  for (const r of requests) {
    if (r.status === "pending") {
      entries.delete(r.targetUserId);
      entries.set(r.targetUserId, "must_roll");
    }
  }
  return [...entries].map(([userId, reason]) => ({ userId, name: names[userId] ?? "Joueur", reason }));
}

/** Les messages des autres après le dernier lu (`null` : jamais lu). */
export function unreadCount(feed: readonly RemoteFeedMessage[], lastReadSeq: number | null): number {
  return feed.filter((m) => !m.mine && m.seq > (lastReadSeq ?? 0)).length;
}
