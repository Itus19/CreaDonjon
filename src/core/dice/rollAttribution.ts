import type { TraceStep } from "../formula/evaluate";

/**
 * Ce que chaque jet enregistré dit de lui-même pour les statistiques
 * (V3.1-89, ADR 0064). Écrit par le serveur au moment du jet (règle 8),
 * jamais recalculé ensuite à partir d'un texte.
 */

/** Nature d'un jet, pour regrouper « l'action la plus utilisée » sans analyser de texte. */
export const DICE_ROLL_KINDS = ["attack", "damage", "check", "save", "spell", "heal", "free"] as const;
export type DiceRollKind = (typeof DICE_ROLL_KINDS)[number];

/** Une étape de trace d'un d20 unique, simple ou avec avantage / désavantage (un seul dé gardé). */
const SINGLE_D20_STEP = /^(1d20|2d20k[hl]1) \(/;

/**
 * Le d20 GARDÉ d'un jet : avec avantage, le plus haut ; avec désavantage,
 * le plus bas. C'est la valeur de l'étape du dé, puisque `2d20kh1` garde
 * déjà le bon. `undefined` sans d20, ou s'il y en a plusieurs : on ne
 * devine jamais lequel compte.
 */
export function naturalD20FromTrace(trace: readonly TraceStep[]): number | undefined {
  const steps = trace.filter((s) => SINGLE_D20_STEP.test(s.text));
  if (steps.length !== 1) return undefined;
  const value = steps[0].value;
  return Number.isInteger(value) && value >= 1 && value <= 20 ? value : undefined;
}
