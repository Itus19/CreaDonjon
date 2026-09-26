import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import type { FilItem } from "@/lib/solo/types";
import type { TraceStep } from "@/src/core/formula/evaluate";
import { listSessionEvents, type SessionEventRow } from "@/src/server/repos/sessions";

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
  const npc = payload.npc_reaction as { npc_id: string; text: string } | null | undefined;
  return {
    ...base,
    kind: "narration",
    text: String(payload.text ?? ""),
    npcReaction: npc ? { npcId: npc.npc_id, text: npc.text } : null,
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

  if (check) {
    return { ...base, kind: "roll", facts, total: check.total, verdict: check.verdict, trace: check.trace, origin };
  }
  if (attack) {
    const verdict = attackVerdict === "hit" ? "success" : attackVerdict === "miss" ? "fail" : null;
    return { ...base, kind: "roll", facts, total: attack.total, verdict, trace: attack.trace, origin };
  }
  if (damage) {
    return { ...base, kind: "roll", facts, total: damage.total, verdict: null, trace: damage.trace, origin };
  }
  // Ne devrait jamais arriver (un `roll` porte toujours l'une des trois cles
  // depuis `finishResolution`, turnIntent.ts) : un repli honnete plutot
  // qu'un ecran qui casse si un jour un appelant en ecrit un autrement.
  return { ...base, kind: "roll", facts, total: null, verdict: null, trace: [], origin };
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

export async function buildFilForSession(supabase: TypedClient, sessionId: string): Promise<FilItem[]> {
  const events = await listSessionEvents(supabase, sessionId);
  return events.map(mapSessionEventToFilItem);
}
