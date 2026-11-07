import type { Rng } from "../dice/rng";
import { evaluate } from "../formula/evaluate";
import type { FormulaNode } from "../formula/ast";
import type { Activation, ActivationBlockData } from "../schemas/rule-blocks/playable";
import { spendFromBudget, type ActionBudget, type BudgetKind } from "./actionBudget";
import { instantiateDurableEffect, type ActiveDurableEffect } from "./durableEffects";
import { resolveEffectList, type ConditionNode, type EffectNode, type ResolvedEffect, type TriggerContext } from "./triggers";

/**
 * V3.1-129 (ADR 0060 §2 et §5) — jouer une règle, en fonction PURE.
 *
 * `planActivation` vérifie `requires`, le coût, les ressources et les cibles,
 * lance les dés par le `Rng` injecté (jamais un modèle : règle absolue 8),
 * résout les effets avec le vocabulaire des déclencheurs et rend un PLAN :
 * usages consommés, budget, effets résolus, effets qui durent à poser. Un
 * refus ne lance aucun dé et n'écrit rien. Le service applique le plan en
 * une seule écriture (V3.1-130).
 *
 * Dans les effets, `self` désigne celui qui active et `target` chaque cible :
 * la liste d'effets est résolue UNE fois par cible (une sauvegarde chacune).
 */

export type ActivationRefusal =
  | "unknown_activation"
  | "unknown_variant"
  | "requires_not_met"
  | "not_enough_resource"
  | "no_target"
  | "too_many_targets"
  | "unknown_target"
  | "unknown_effect"
  | "invalid_formula";

export interface ActivationPlan {
  activationId: string;
  variantId: string | null;
  /** Ce qui est dépensé, ressource par ressource. */
  spend: { key: string; amount: number }[];
  /** Usages consommés après l'activation (forme de `state.resources`). */
  used: Record<string, number>;
  /** Budget après paiement ; `null` hors combat (aucun budget tenu). */
  budget: ActionBudget | null;
  /** Le budget passe dans le rouge : le moteur l'affiche, il ne bloque pas (ADR 0029). */
  overBudget: boolean;
  effects: ResolvedEffect[];
  /** Les effets qui durent à poser, déjà ancrés (porteur, source, durée). */
  applied: ActiveDurableEffect[];
}

export type ActivationResult = { ok: true; plan: ActivationPlan } | { ok: false; reason: ActivationRefusal; detail?: string };

/** `magic` se paie sur l'action ; `none`, sur rien. */
const BUDGET_DU_COUT: Record<Activation["cost"]["action"], BudgetKind | null> = {
  action: "action",
  magic: "action",
  bonus: "bonus",
  reaction: "reaction",
  free: "free",
  none: null,
};

class Refus extends Error {
  constructor(
    readonly reason: ActivationRefusal,
    readonly detail?: string,
  ) {
    super(reason);
  }
}

/** Remplace `self` et `target` par des identifiants d'acteurs, partout où un acteur est nommé. */
function bindActors<T>(value: T, roles: Readonly<Record<string, string>>): T {
  const swap = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(swap);
    if (v === null || typeof v !== "object") return v;
    const out: Record<string, unknown> = {};
    for (const [key, x] of Object.entries(v)) {
      out[key] = (key === "who" || key === "of") && typeof x === "string" && x in roles ? roles[x] : swap(x);
    }
    return out;
  };
  return swap(value) as T;
}

function nombre(node: FormulaNode, refs: Readonly<Record<string, number>>, rng: Rng): number {
  try {
    return evaluate(node, refs, rng, "roll").value;
  } catch (err) {
    throw new Refus("invalid_formula", err instanceof Error ? err.message : String(err));
  }
}

function conditionRemplie(node: ConditionNode, ctx: TriggerContext, actorId: string, rng: Rng): boolean {
  // `requires` se lit avec les nombres de celui qui active (« niveau 3 ou plus »).
  const refs = ctx.actors[actorId]?.numbers ?? {};
  const n = (f: FormulaNode) => nombre(f, refs, rng);
  switch (node.op) {
    case "and":
      return node.args.every((a) => conditionRemplie(a, ctx, actorId, rng));
    case "or":
      return node.args.some((a) => conditionRemplie(a, ctx, actorId, rng));
    case "not":
      return !conditionRemplie(node.args[0], ctx, actorId, rng);
    case "eq":
      return n(node.args[0]) === n(node.args[1]);
    case "gte":
      return n(node.args[0]) >= n(node.args[1]);
    case "lte":
      return n(node.args[0]) <= n(node.args[1]);
    case "has_condition":
      return ctx.actors[node.who === "self" ? actorId : node.who]?.conditions.includes(node.key) ?? false;
    case "has_feature":
      return ctx.actors[node.who === "self" ? actorId : node.who]?.features.includes(node.key) ?? false;
    // Sans événement ni position au clic : ces deux-là ne peuvent pas être vrais ici.
    case "event_has":
    case "in_range":
      return false;
  }
}

/**
 * V3.1-159 — `requires` d'une activation, lu avec les nombres de celui qui
 * active. Une formule invalide ne remplit pas la condition (le refus de
 * `planActivation` le dira au clic).
 */
export function requirementMet(activation: Pick<Activation, "requires">, ctx: TriggerContext, actorId: string, rng: Rng): boolean {
  if (!activation.requires) return true;
  try {
    return conditionRemplie(activation.requires, ctx, actorId, rng);
  } catch (err) {
    if (err instanceof Refus) return false;
    throw err;
  }
}

export function planActivation(p: {
  block: ActivationBlockData;
  activationId: string;
  variantId?: string | null;
  actorId: string;
  targetIds: readonly string[];
  /** Acteurs de la scène : celui qui active (ses nombres : `level`, `ability.*`, `spell_save_dc`…) et les cibles (`save.*`). */
  ctx: TriggerContext;
  /** Ressources calculées du personnage (`characterSheet().resources`) : clé et maximum. */
  resources: readonly { key: string; max: number }[];
  /** Usages déjà consommés (`state.resources`). */
  used: Readonly<Record<string, number>>;
  budget: ActionBudget | null;
  /** À qui est le tour : ancre « jusqu'à la fin de votre prochain tour ». */
  currentTurn: string | null;
  round: number | null;
  rng: Rng;
  locale?: string;
}): ActivationResult {
  try {
    const activation = p.block.activations.find((a) => a.id === p.activationId);
    if (!activation) throw new Refus("unknown_activation");
    const variant = p.variantId ? activation.variants?.find((v) => v.id === p.variantId) : undefined;
    if (p.variantId && !variant) throw new Refus("unknown_variant");
    const cost = variant?.cost ?? activation.cost;
    const effects: EffectNode[] = variant ? variant.effects : activation.effects;

    const actor = p.ctx.actors[p.actorId];
    if (!actor) throw new Refus("unknown_target", p.actorId);
    const refs = actor.numbers;

    if (activation.requires && !conditionRemplie(activation.requires, p.ctx, p.actorId, p.rng)) throw new Refus("requires_not_met");

    // Ressources : tout ou rien, AVANT le moindre dé.
    const spend = cost.resources.map((r) => ({ key: r.key, amount: nombre(r.amount, refs, p.rng) }));
    const used: Record<string, number> = { ...p.used };
    for (const s of spend) {
      const max = p.resources.find((r) => r.key === s.key)?.max ?? 0;
      const deja = used[s.key] ?? 0;
      if (deja + s.amount > max) throw new Refus("not_enough_resource", s.key);
      used[s.key] = deja + s.amount;
    }

    // Cibles.
    let cibles: string[];
    if (activation.targets.kind === "self") {
      cibles = [p.actorId];
    } else {
      if (p.targetIds.length === 0) throw new Refus("no_target");
      const max = activation.targets.count ? nombre(activation.targets.count, refs, p.rng) : 1;
      if (p.targetIds.length > max) throw new Refus("too_many_targets");
      const absente = p.targetIds.find((t) => !p.ctx.actors[t]);
      if (absente) throw new Refus("unknown_target", absente);
      cibles = [...p.targetIds];
    }

    // Budget : payé, jamais bloquant (ADR 0029).
    const kind = BUDGET_DU_COUT[cost.action];
    let budget = p.budget;
    let overBudget = false;
    if (budget && kind) {
      const r = spendFromBudget(budget, kind);
      budget = r.budget;
      overBudget = r.overBudget;
    }

    // Effets : une résolution par cible. Les dés sont lancés ici, par le moteur.
    const fired = { event: "spell_cast" as const, subject: p.actorId };
    const resolved: ResolvedEffect[] = [];
    for (const cible of cibles) {
      const lies = bindActors(effects, { self: p.actorId, target: cible });
      try {
        resolved.push(...resolveEffectList(lies, p.ctx, fired, p.rng));
      } catch (err) {
        throw new Refus("invalid_formula", err instanceof Error ? err.message : String(err));
      }
    }

    // Effets qui durent : ancrés sur leur porteur et leur source.
    const applied: ActiveDurableEffect[] = [];
    for (const e of resolved) {
      if (e.action !== "apply_effect") continue;
      const def = p.block.durable_effects.find((d) => d.id === e.effect);
      if (!def) throw new Refus("unknown_effect", e.effect);
      applied.push(
        instantiateDurableEffect(def, { bearer: e.who, source: p.actorId, activationId: activation.id, round: p.round, currentTurn: p.currentTurn, locale: p.locale }),
      );
    }

    return {
      ok: true,
      plan: { activationId: activation.id, variantId: variant?.id ?? null, spend, used, budget, overBudget, effects: resolved, applied },
    };
  } catch (err) {
    if (err instanceof Refus) return err.detail === undefined ? { ok: false, reason: err.reason } : { ok: false, reason: err.reason, detail: err.detail };
    throw err;
  }
}

/**
 * ADR 0060 §4 — les blocs qui portent de la mécanique jouée par le moteur.
 * Une fiche qui n'a que de la prose (`description`, `traits`…) n'est pas
 * évaluée ; elle le devient en recevant l'un de ceux-ci, ou des lacunes.
 */
export const MECHANICAL_BLOCK_TYPES = [
  "modifiers",
  "triggers",
  "resources",
  "activation",
  "effects",
  "weapon",
  "armor",
  "choices",
  "character_rules",
  "class_progression",
] as const;

export type CoverageState = "playable" | "partial" | "unevaluated";

/** Calculé, jamais stocké : jouable (un bloc mécanique, aucune lacune), partielle (des lacunes), non évaluée. */
export function coverageState(p: { blockTypes: readonly string[]; gaps: readonly unknown[] }): CoverageState {
  if (p.gaps.length > 0) return "partial";
  return p.blockTypes.some((t) => (MECHANICAL_BLOCK_TYPES as readonly string[]).includes(t)) ? "playable" : "unevaluated";
}
