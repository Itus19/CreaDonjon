import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import type { FilItem } from "@/lib/solo/types";
import type { TraceStep } from "@/src/core/formula/evaluate";
import { listSessionEvents, type SessionEventRow } from "@/src/server/repos/sessions";
import { undoneEventIds, type JournalEvent } from "@/src/core/rules/turnUndo";
import { summarizeTurns, timeChipText } from "@/src/core/rules/turnSummary";
import type { GameTime } from "@/src/core/rules/scene";

type TypedClient = SupabaseClient<Database>;

/**
 * V3-D4 — Le fil, tel que `session_events` le rend.
 *
 * « Le fil EST `session_events` rendu. Recharger la page le reconstruit à
 * l'identique » — c'est ce qui referme la limite connue de V3-B1/B2, où le
 * fil de l'écran solo était un état de composant (`IntentBar`'s `turns`),
 * perdu au moindre rechargement alors que les faits, eux, étaient déjà en
 * base. Ce module ne construit rien de nouveau : il relit ce que B1, B2,
 * B4 et B5 ont déjà écrit, chacun dans SA forme de payload — c'est le seul
 * endroit qui doit connaître ces formes, verrouillé par
 * `turnFil.test.ts`.
 *
 * `kind: "roll"` couvre trois sous-formes distinctes selon la clé
 * présente dans le payload (`check`, `attack`, `damage`) — jamais deux à
 * la fois depuis V3-B5 (une attaque et ses dégâts sont deux événements
 * `roll` séparés, chaînés, pas un seul événement combiné).
 */

function mapNarration(base: { id: string; seq: number; createdAt: string }, payload: Record<string, unknown>): FilItem {
  const npc = payload.npc_reaction as { npc_id: string; text: string; npc_name?: unknown; npc_attitude?: unknown } | null | undefined;
  return {
    ...base,
    kind: "narration",
    text: String(payload.text ?? ""),
    npcReaction: npc
      ? {
          npcId: npc.npc_id,
          text: npc.text,
          // Absents des répliques écrites avant qu'on les garde : `null`, jamais un nom deviné.
          npcName: typeof npc.npc_name === "string" && npc.npc_name !== "" ? npc.npc_name : null,
          attitude: typeof npc.npc_attitude === "string" && npc.npc_attitude !== "" ? npc.npc_attitude : null,
        }
      : null,
  };
}

function mapPlayerAction(base: { id: string; seq: number; createdAt: string }, payload: Record<string, unknown>): FilItem {
  const intent = payload.intent as { text?: string } | undefined;
  return { ...base, kind: "player_action", text: intent?.text ?? "", facts: (payload.facts as string[] | undefined) ?? [] };
}

function mapRoll(base: { id: string; seq: number; createdAt: string }, payload: Record<string, unknown>): FilItem {
  const facts = (payload.facts as string[] | undefined) ?? [];
  const origin = (payload.origin as string | undefined) ?? null;
  const check = payload.check as { total: number; verdict: "success" | "fail" | null; trace: TraceStep[] } | undefined;
  const attack = payload.attack as { total: number; trace: TraceStep[] } | null | undefined;
  const damage = payload.damage as { total: number; trace: TraceStep[] } | null | undefined;
  const attackVerdict = payload.verdict as "hit" | "miss" | null | undefined;
  // V3.2-20 : la phrase du joueur, montrée en bulle au-dessus du jet. Pas pour
  // les dégâts chaînés : ils portent la même phrase que l'attaque qui les précède.
  const intent = payload.intent as { text?: unknown; kind?: unknown } | undefined;
  const actionText = typeof intent?.text === "string" && intent.text !== "" && intent.kind !== "weapon_damage" ? intent.text : null;

  if (check) {
    return { ...base, kind: "roll", facts, total: check.total, verdict: check.verdict, trace: check.trace, origin, actionText };
  }
  if (attack) {
    const verdict = attackVerdict === "hit" ? "success" : attackVerdict === "miss" ? "fail" : null;
    return { ...base, kind: "roll", facts, total: attack.total, verdict, trace: attack.trace, origin, actionText };
  }
  if (damage) {
    return { ...base, kind: "roll", facts, total: damage.total, verdict: null, trace: damage.trace, origin, actionText };
  }
  // Ne devrait jamais arriver (un `roll` porte toujours l'une des trois cles
  // depuis `finishResolution`, turnIntent.ts) : un repli honnete plutot
  // qu'un ecran qui casse si un jour un appelant en ecrit un autrement.
  return { ...base, kind: "roll", facts, total: null, verdict: null, trace: [], origin, actionText };
}

function mapRuleApplication(base: { id: string; seq: number; createdAt: string }, payload: Record<string, unknown>): FilItem {
  // `changes_text`/`hints_text`/`ignored_text` sont deja les phrases telles
  // qu'affichees a l'ecran au moment du tour — jamais recalculees depuis
  // `changes` (TurnChange bruts), qui demanderait de rejouer `nameOf`.
  return {
    ...base,
    kind: "rule_application",
    changes: (payload.changes_text as string[] | undefined) ?? [],
    hints: (payload.hints_text as string[] | undefined) ?? [],
    ignored: (payload.ignored_text as string[] | undefined) ?? [],
  };
}

function mapWorldUpdate(base: { id: string; seq: number; createdAt: string }, payload: Record<string, unknown>): FilItem {
  return { ...base, kind: "world_update", note: String(payload.note ?? "") };
}

/** V3-D4 — la reponse du MJ a une question posee hors du temps de jeu (`askSoloGm`, `src/server/ai/soloGmQuestion.ts`). */
function mapNote(base: { id: string; seq: number; createdAt: string }, payload: Record<string, unknown>): FilItem {
  return { ...base, kind: "note", question: String(payload.question ?? ""), answer: String(payload.answer ?? "") };
}

export function mapSessionEventToFilItem(row: SessionEventRow): FilItem {
  const base = { id: row.id, seq: row.seq, createdAt: row.created_at };
  const payload = (row.payload as Record<string, unknown> | null) ?? {};
  switch (row.kind) {
    case "narration":
      return mapNarration(base, payload);
    case "player_action":
      return mapPlayerAction(base, payload);
    case "roll":
      return mapRoll(base, payload);
    case "rule_application":
      return mapRuleApplication(base, payload);
    case "world_update":
      return mapWorldUpdate(base, payload);
    case "note":
      return mapNote(base, payload);
    default:
      // `system` : dans l'enum de SCHEMA.md §12, jamais ecrit aujourd'hui.
      // Un repli plutot qu'une exception — le fil reste lisible meme pour
      // un genre que ce module ne connait pas encore.
      return { ...base, kind: "other", label: row.kind };
  }
}

export async function buildFilForSession(supabase: TypedClient, sessionId: string, maintenant: GameTime | null = null): Promise<FilItem[]> {
  const events = await listSessionEvents(supabase, sessionId);
  return withTurnSummaries(visibleInFil(events), maintenant);
}

const versJournal = (e: SessionEventRow): JournalEvent => ({ id: e.id, seq: e.seq, kind: e.kind, actor: e.actor, payload: (e.payload as Record<string, unknown> | null) ?? {} });

/**
 * V3.2-22 (ADR 0113) — le fil avec la ligne de chaque tour. Dans un tour, les
 * changements du moteur et du monde passent dans cette ligne au lieu de
 * s'afficher chacun à part ; hors tour (une scène posée avant toute action),
 * ils restent comme avant. `maintenant` : l'heure actuelle de la scène, qui
 * ferme le dernier tour.
 */
export function withTurnSummaries(events: readonly SessionEventRow[], maintenant: GameTime | null): FilItem[] {
  const resumes = summarizeTurns(events.map(versJournal), maintenant);
  const parFin = new Map(resumes.map((r) => [r.afterEventId, r]));
  // Le début du premier tour : avant lui, rien n'est replié.
  const premierTour = events.find((e) => e.id === resumes[0]?.startEventId)?.seq ?? Infinity;
  const items: FilItem[] = [];
  for (const e of [...events].sort((a, b) => a.seq - b.seq)) {
    const replie = e.seq >= premierTour && (e.kind === "rule_application" || e.kind === "world_update");
    if (!replie) items.push(mapSessionEventToFilItem(e));
    const r = parFin.get(e.id);
    if (r) {
      items.push({
        id: `tour-${r.startEventId}`,
        seq: r.afterSeq,
        createdAt: e.created_at,
        kind: "turn_summary",
        time: r.time ? timeChipText(r.time) : null,
        changes: r.changes,
        hints: r.hints,
        ignored: r.ignored,
        worldNotes: r.worldNotes,
        last: r.last,
      });
    }
  }
  return items;
}

/**
 * V3-F2 — le fil ne montre ni les événements d'un tour annulé, ni l'annulation
 * elle-même : le journal les garde (ajout seul), l'écran raconte la partie
 * telle qu'elle continue.
 */
export function visibleInFil(events: readonly SessionEventRow[]): SessionEventRow[] {
  const defaits = undoneEventIds(events.map((e) => ({ id: e.id, seq: e.seq, kind: e.kind, actor: e.actor, payload: (e.payload as Record<string, unknown> | null) ?? {} })));
  return events.filter((e) => !defaits.has(e.id) && !(e.kind === "system" && (e.payload as { undo_turn?: unknown } | null)?.undo_turn !== undefined));
}
