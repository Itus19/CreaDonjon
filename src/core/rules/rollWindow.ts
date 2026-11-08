import { distance, type Point } from "./geometry";
import { z } from "zod";
import type { Rng } from "../dice/rng";
import { evaluate } from "../formula/evaluate";
import type { FormulaNode } from "../formula/ast";
import type { Activation, ActivationTrigger, RollOperation } from "../schemas/rule-blocks/playable";
import { requirementMet } from "./activation";
import { attackVerdict } from "./targeting";
import { zTurnBudget } from "./turnBudget";
import type { TriggerContext } from "./triggers";

/**
 * V3.1-159 (ADR 0075) — intervenir sur un jet, en fonctions PURES.
 *
 * Un jet arrêté à un point de décision (`PendingRoll`) : le d20 est connu,
 * l'issue se calcule, rien n'est encore appliqué. `eligibleReactions` dit qui
 * PEUT réagir (déclencheur, `requires`, ressources, réaction libre, limite) ;
 * `applyRollOperations` applique les réponses, dans l'ordre reçu, et l'issue
 * est refaite par les règles existantes (`attackVerdict`, total contre DD).
 * Les dés passent par le `Rng` injecté : jamais un modèle (règle absolue 8).
 * La portée n'est pas vérifiée ici : là où il y a des zones (solo), l'appelant
 * filtre ; ailleurs elle attend les distances réelles (V3.1-137).
 */

export type PendingRollKind = "attack" | "save" | "check" | "damage";

export interface PendingRoll {
  kind: PendingRollKind;
  /** Celui qui a lancé le jet (l'attaquant, celui qui sauvegarde ou teste). */
  roller: string;
  /** La créature attaquée (attaque, dégâts) ; `null` sinon. */
  target: string | null;
  /** Le d20 gardé ; `null` pour des dégâts. */
  natural: number | null;
  /** Le total (d20 et modificateurs) ; pour des dégâts, recalculé depuis `damage`. */
  total: number;
  /** Plage de critique de l'attaquant (19 au Champion). */
  critRange: number;
  ac: number | null;
  dc: number | null;
  /** Bonus de CA contre ce jet seulement (Bouclier). */
  acBonus: number;
  /** Dégâts : la somme lancée, puis le facteur (Esquive instinctive : ½), arrondi à l'inférieur. */
  damage: { base: number; multiplier: number } | null;
}

export type RollOutcome = "hit" | "miss" | "success" | "failure";

/** L'issue du jet, refaite par les règles existantes ; `null` si elle ne se sait pas (pas de CA, pas de DD, des dégâts). */
export function outcomeOf(roll: PendingRoll): RollOutcome | null {
  if (roll.kind === "attack") {
    const natural = roll.natural ?? 0;
    const v = attackVerdict({ total: roll.total, isCritical: natural >= roll.critRange, isCriticalFail: natural === 1 }, roll.ac === null ? null : roll.ac + roll.acBonus);
    return v;
  }
  if (roll.kind === "damage" || roll.dc === null) return null;
  return roll.total >= roll.dc ? "success" : "failure";
}

// --- le compte (combat) --------------------------------------------------------

/** Stocké sur `combat_participants.turn_usage` (V3.1-160). */
export const zTurnUsage = z.object({
  /** `"<round>:<turn_index>"` de la dernière réaction dépensée ; elle revient au début du tour suivant du participant. */
  reaction_at: z.string().nullable(),
  /** `"<règle>:<activation>"` → `"<round>:<turn_index>"` du dernier usage. */
  once: z.record(z.string(), z.string()),
  /** V3.1-164 (ADR 0076) : le budget du dernier tour du participant (`turnBudget.ts`). */
  budget: zTurnBudget.optional(),
});
export type TurnUsage = z.infer<typeof zTurnUsage>;

export const EMPTY_TURN_USAGE: TurnUsage = { reaction_at: null, once: {} };

export function turnStamp(round: number, turnIndex: number): string {
  return `${round}:${turnIndex}`;
}

export function limitKey(ruleKey: string, activationId: string): string {
  return `${ruleKey}:${activationId}`;
}

/** La limite tient-elle encore ? `stamp` null : hors combat, rien n'est compté. */
function limitAllows(usage: TurnUsage, key: string, per: "turn" | "round", stamp: string | null): boolean {
  if (stamp === null) return true;
  const last = usage.once[key];
  if (last === undefined) return true;
  if (per === "turn") return last !== stamp;
  return last.split(":")[0] !== stamp.split(":")[0];
}

/** Note un usage : la date de la réaction dépensée, et celle de l'usage limité. Hors combat (stamp null), rien. */
export function recordUse(usage: TurnUsage, p: { key: string | null; reaction: boolean; stamp: string | null }): TurnUsage {
  if (p.stamp === null) return usage;
  return {
    // Le reste du compte (le budget du tour, V3.1-164) est gardé tel quel.
    ...usage,
    reaction_at: p.reaction ? p.stamp : usage.reaction_at,
    once: p.key ? { ...usage.once, [p.key]: p.stamp } : usage.once,
  };
}

function parseStamp(stamp: string): [number, number] {
  const [r, t] = stamp.split(":").map(Number);
  return [r, t];
}

/**
 * La réaction est-elle revenue ? Elle revient au début du prochain tour du
 * participant (`ownTurnIndex`) ; s'il n'a pas de place dans l'ordre, au round
 * suivant. Calculé, jamais remis à zéro par une écriture : le passage de tour
 * et son annulation n'ont rien à faire.
 */
export function reactionAvailable(usage: TurnUsage, stamp: string | null, ownTurnIndex: number | null): boolean {
  if (stamp === null || usage.reaction_at === null) return true;
  const [r, t] = parseStamp(usage.reaction_at);
  const [R, T] = parseStamp(stamp);
  const own = ownTurnIndex ?? 0;
  const back: [number, number] = ownTurnIndex !== null && own > t ? [r, own] : [r + 1, own];
  return R > back[0] || (R === back[0] && T >= back[1]);
}

// --- qui peut réagir -----------------------------------------------------------

export interface ReactionCandidate {
  actorId: string;
  /** La fiche de règle qui porte l'activation. */
  ruleKey: string;
  activation: Activation;
  /** Ressources calculées du personnage, et usages consommés. */
  resources: readonly { key: string; max: number }[];
  used: Readonly<Record<string, number>>;
  usage: TurnUsage;
  /** Sa place dans l'ordre du combat (`turn_index`) ; `null` hors de l'ordre. */
  ownTurnIndex: number | null;
}

export interface EligibleReaction {
  actorId: string;
  ruleKey: string;
  activationId: string;
  automatic: boolean;
  /** Se paie sur la réaction du round. */
  reaction: boolean;
  /** La clé du compte « une fois par tour », s'il y a une limite. */
  limitKey: string | null;
  /** Le moteur sait-il que la réaction changerait l'issue ? `null` : un dé décidera. */
  changesOutcome: boolean | null;
  range: ActivationTrigger["range"] | null;
}

function rollMatches(trigger: ActivationTrigger, kind: PendingRollKind): boolean {
  if (trigger.roll === "d20") return kind !== "damage";
  return trigger.roll === kind;
}

function subjectMatches(trigger: ActivationTrigger, roll: PendingRoll, actorId: string, teams: Readonly<Record<string, string>>): boolean {
  const mine = teams[actorId];
  const theirs = teams[roll.roller];
  switch (trigger.subject) {
    case "self":
      return roll.roller === actorId;
    case "attack_against_self":
      return (roll.kind === "attack" || roll.kind === "damage") && roll.target === actorId;
    case "ally":
      return roll.roller !== actorId && mine !== undefined && mine === theirs;
    case "enemy":
      return mine !== undefined && theirs !== undefined && mine !== theirs;
    case "any":
      return true;
  }
}

function momentMatches(trigger: ActivationTrigger, roll: PendingRoll): boolean {
  const outcome = outcomeOf(roll);
  switch (trigger.when) {
    case "rolled":
      return true;
    case "hit":
      return outcome === "hit";
    case "failed":
      return outcome === "miss" || outcome === "failure";
    case "natural":
      return roll.natural !== null && roll.natural === trigger.natural;
  }
}

/** Une formule qui ne s'évalue pas rend son erreur (jamais avalée) : l'appelant décide. */
function amount(node: FormulaNode, numbers: Readonly<Record<string, number>>, rng: Rng): number | Error {
  try {
    return evaluate(node, numbers, rng, "roll").value;
  } catch (err) {
    return err instanceof Error ? err : new Error(String(err));
  }
}

/** Sans l'une des deux positions, la portée n'est pas vérifiable : on laisse passer (le MJ tranche). */
function withinRange(a: Point | undefined, b: Point | undefined, metres: number): boolean {
  return !a || !b || distance(a, b) <= metres + 1e-9;
}

function canPay(c: ReactionCandidate, numbers: Readonly<Record<string, number>>, rng: Rng): boolean {
  const total: Record<string, number> = {};
  for (const r of c.activation.cost.resources) {
    const a = amount(r.amount, numbers, rng);
    // Un coût illisible ne se paie pas : la réaction n'est pas proposée (le clic sur la fiche, lui, dit l'erreur).
    if (a instanceof Error) return false;
    total[r.key] = (total[r.key] ?? 0) + a;
  }
  return Object.entries(total).every(([key, a]) => (c.used[key] ?? 0) + a <= (c.resources.find((r) => r.key === key)?.max ?? 0));
}

export function eligibleReactions(p: {
  roll: PendingRoll;
  candidates: readonly ReactionCandidate[];
  ctx: TriggerContext;
  /** Camp de chaque acteur : même camp = allié. */
  teams: Readonly<Record<string, string>>;
  /** `turnStamp` du tour en cours ; `null` hors combat. */
  stamp: string | null;
  rng: Rng;
  /**
   * V3.1-169 (ADR 0077) : les positions sur le plan, par acteur. Une réaction
   * à portée (`trigger.range`) se mesure de celui qui réagit à celui qui a
   * lancé le jet ; sans l'une des deux positions, elle reste proposée.
   */
  positions?: Readonly<Record<string, Point>>;
}): { automatic: EligibleReaction[]; choices: EligibleReaction[] } {
  const automatic: EligibleReaction[] = [];
  const choices: EligibleReaction[] = [];
  const seen = new Set<string>();
  for (const c of p.candidates) {
    const t = c.activation.trigger;
    if (!t) continue;
    const id = `${c.actorId}|${c.ruleKey}|${c.activation.id}`;
    if (seen.has(id)) continue;
    if (!rollMatches(t, p.roll.kind) || !subjectMatches(t, p.roll, c.actorId, p.teams) || !momentMatches(t, p.roll)) continue;
    if (t.range && !withinRange(p.positions?.[c.actorId], p.positions?.[p.roll.roller], t.range.value)) continue;
    const numbers = p.ctx.actors[c.actorId]?.numbers ?? {};
    if (!requirementMet(c.activation, p.ctx, c.actorId, p.rng)) continue;
    const reaction = c.activation.cost.action === "reaction";
    // Hors combat (stamp null), la réaction n'est pas comptée : il n'y a pas de round.
    if (reaction && !reactionAvailable(c.usage, p.stamp, c.ownTurnIndex)) continue;
    const key = c.activation.limit ? limitKey(c.ruleKey, c.activation.id) : null;
    if (key && c.activation.limit && !limitAllows(c.usage, key, c.activation.limit.per, p.stamp)) continue;
    if (!canPay(c, numbers, p.rng)) continue;
    seen.add(id);
    const e: EligibleReaction = {
      actorId: c.actorId,
      ruleKey: c.ruleKey,
      activationId: c.activation.id,
      automatic: t.automatic === true,
      reaction,
      limitKey: key,
      changesOutcome: wouldChangeOutcome(p.roll, c.activation.roll_operations ?? [], numbers),
      range: t.range ?? null,
    };
    (e.automatic ? automatic : choices).push(e);
  }
  return { automatic, choices };
}

// --- ce que la réaction fait au jet ----------------------------------------------

export interface ReactionApplication {
  actorId: string;
  operations: readonly RollOperation[];
  /** Les nombres de celui qui réagit (`class.level`, `ability.cha`…). */
  numbers: Readonly<Record<string, number>>;
}

export interface OperationStep {
  actorId: string;
  op: RollOperation["op"];
  /** Ce que l'opération a changé : dés lancés, nouveau d20, bonus. */
  value: number;
  dice: number[];
}

function rollDie(faces: number, rng: Rng): number {
  return rng.nextInt(faces) + 1;
}

function withDamageTotal(roll: PendingRoll): PendingRoll {
  if (!roll.damage) return roll;
  return { ...roll, total: Math.floor(roll.damage.base * roll.damage.multiplier) };
}

/** Applique les réponses dans l'ordre donné (auteur, cible, autres : l'appelant ordonne). */
export function applyRollOperations(start: PendingRoll, applications: readonly ReactionApplication[], rng: Rng): { roll: PendingRoll; steps: OperationStep[] } {
  let roll = { ...start, damage: start.damage ? { ...start.damage } : null };
  const steps: OperationStep[] = [];
  for (const a of applications) {
    for (const op of a.operations) {
      switch (op.op) {
        case "add_die": {
          const count = Math.max(0, Math.trunc(evaluate(op.count, a.numbers, rng, "roll").value));
          const faces = Math.max(1, Math.trunc(evaluate(op.faces, a.numbers, rng, "roll").value));
          const dice = Array.from({ length: count }, () => rollDie(faces, rng));
          const value = op.sign * dice.reduce((x, y) => x + y, 0);
          roll = roll.damage ? withDamageTotal({ ...roll, damage: { ...roll.damage, base: roll.damage.base + value } }) : { ...roll, total: roll.total + value };
          steps.push({ actorId: a.actorId, op: op.op, value, dice });
          break;
        }
        case "reroll": {
          if (roll.natural === null) break;
          const d = rollDie(20, rng);
          const bonus = op.bonus ? evaluate(op.bonus, a.numbers, rng, "roll").value : 0;
          roll = { ...roll, total: roll.total - roll.natural + d + bonus, natural: d };
          steps.push({ actorId: a.actorId, op: op.op, value: d + bonus, dice: [d] });
          break;
        }
        case "set_natural": {
          if (roll.natural === null) break;
          roll = { ...roll, total: roll.total - roll.natural + op.value, natural: op.value };
          steps.push({ actorId: a.actorId, op: op.op, value: op.value, dice: [] });
          break;
        }
        case "ac_bonus": {
          const value = evaluate(op.value, a.numbers, rng, "roll").value;
          roll = { ...roll, acBonus: roll.acBonus + value };
          steps.push({ actorId: a.actorId, op: op.op, value, dice: [] });
          break;
        }
        case "damage_multiplier": {
          if (!roll.damage) break;
          roll = withDamageTotal({ ...roll, damage: { ...roll.damage, multiplier: roll.damage.multiplier * op.factor } });
          steps.push({ actorId: a.actorId, op: op.op, value: op.factor, dice: [] });
          break;
        }
        case "add_damage": {
          if (!roll.damage) break;
          const r = evaluate(op.formula, a.numbers, rng, "roll");
          roll = withDamageTotal({ ...roll, damage: { ...roll.damage, base: roll.damage.base + r.value } });
          steps.push({ actorId: a.actorId, op: op.op, value: r.value, dice: [] });
          break;
        }
      }
    }
  }
  return { roll, steps };
}

function attempt<T>(f: () => T): T | Error {
  try {
    return f();
  } catch (err) {
    return err instanceof Error ? err : new Error(String(err));
  }
}

const RANDOM_OPS: ReadonlySet<RollOperation["op"]> = new Set(["add_die", "reroll", "add_damage"]);

/**
 * La réaction changerait-elle l'issue ? Seulement quand rien n'est laissé au
 * dé (Bouclier, Coup de chance) ; sinon `null`, jamais une estimation.
 */
export function wouldChangeOutcome(roll: PendingRoll, operations: readonly RollOperation[], numbers: Readonly<Record<string, number>>): boolean | null {
  if (operations.length === 0 || operations.some((o) => RANDOM_OPS.has(o.op))) return null;
  const before = outcomeOf(roll);
  if (before === null) return null;
  const noDice: Rng = { nextInt: () => 0 };
  const after = attempt(() => outcomeOf(applyRollOperations(roll, [{ actorId: roll.roller, operations, numbers }], noDice).roll));
  // Une formule qui ne s'évalue pas : le moteur ne sait pas, il ne devine pas.
  if (after instanceof Error || after === null) return null;
  return after !== before;
}
