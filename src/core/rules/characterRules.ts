import type { Ability } from "./abilities";
import type { MulticlassPrerequisites } from "../schemas/rule-blocks/characterRules";

/**
 * Les règles de personnage d'un ruleset appliquées (V3.1-115, ADR 0046).
 * Chaque fonction reçoit la règle en paramètre : plus aucune constante de
 * jeu ici (le plafond, l'achat de points, la charge viennent de la fiche
 * `character_rules` du ruleset).
 */

/**
 * Coût total d'une répartition en achat de points. `Infinity` pour une valeur
 * hors des bornes du ruleset : l'appelant compare au budget, une valeur
 * interdite ne peut donc jamais passer pour valide.
 */
export function pointBuyCost(scores: Record<Ability, number>, pointBuy: { min: number; max: number; costs: Record<string, number> }): number {
  return (Object.values(scores) as number[]).reduce((sum, score) => {
    if (score < pointBuy.min || score > pointBuy.max) return Infinity;
    const cost = pointBuy.costs[String(score)];
    return sum + (cost ?? Infinity);
  }, 0);
}

/** Toutes les caractéristiques sous le plafond du ruleset. */
export function withinAbilityScoreCap(scores: Record<Ability, number>, cap: number): boolean {
  return (Object.values(scores) as number[]).every((s) => s <= cap);
}

export interface MulticlassCheck {
  met: boolean;
  /** Les conditions non remplies : celles de `all` qui manquent, ou toutes celles de `any` si aucune n'est remplie. */
  unmet: { ability: Ability; min: number }[];
}

/**
 * Prérequis de multiclassage. Un prérequis non rempli est SIGNALÉ, jamais
 * bloquant ici : le MJ peut passer outre (ADR 0046), c'est à l'appelant de
 * décider.
 */
export function checkMulticlassPrerequisites(prereq: MulticlassPrerequisites | undefined, scores: Record<Ability, number>): MulticlassCheck {
  if (!prereq) return { met: true, unmet: [] };
  const unmet = (prereq.all ?? []).filter((c) => scores[c.ability] < c.min);
  const any = prereq.any ?? [];
  const anyMet = any.length === 0 || any.some((c) => scores[c.ability] >= c.min);
  const allUnmet = anyMet ? unmet : [...unmet, ...any];
  return { met: allUnmet.length === 0, unmet: allUnmet };
}
