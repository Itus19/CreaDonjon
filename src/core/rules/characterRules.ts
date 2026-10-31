import type { Ability } from "./abilities";
import type { CharacterRules, MulticlassPrerequisites } from "../schemas/rule-blocks/characterRules";

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

/** Le niveau total dépasse-t-il le plafond de niveau du ruleset ? */
export function exceedsLevelCap(totalLevel: number, levelCap: number): boolean {
  return totalLevel > levelCap;
}

export interface MulticlassEntryCheck {
  met: boolean;
  /** Une entrée par classe dont le prérequis n'est pas rempli, avec ses conditions manquantes. */
  failures: { classKey: string; unmet: MulticlassCheck["unmet"] }[];
}

/**
 * Entrer dans une nouvelle classe (règle 5e) : le prérequis de la NOUVELLE
 * classe et celui de CHAQUE classe actuelle doivent être remplis, avec les
 * caractéristiques actuelles. `classes` liste donc la nouvelle et les actuelles.
 * Un prérequis non rempli est signalé ; c'est à l'appelant de décider si le MJ
 * peut passer outre (ADR 0046).
 */
export function checkMulticlassEntry(
  classes: { key: string; prerequisites?: MulticlassPrerequisites }[],
  scores: Record<Ability, number>
): MulticlassEntryCheck {
  const failures: MulticlassEntryCheck["failures"] = [];
  for (const c of classes) {
    const check = checkMulticlassPrerequisites(c.prerequisites, scores);
    if (!check.met) failures.push({ classKey: c.key, unmet: check.unmet });
  }
  return { met: failures.length === 0, failures };
}

export type StartingTier = NonNullable<CharacterRules["starting_at_higher_level"]>[number];

/**
 * Le palier de départ à haut niveau du niveau total (V3.1-53). `null` hors
 * table, ou quand le palier ne donne rien de plus que l'équipement normal
 * (niveaux 2 à 4 du SRD) : il n'y a alors rien à montrer.
 */
export function startingAtHigherLevel(rules: Pick<CharacterRules, "starting_at_higher_level">, totalLevel: number): StartingTier | null {
  const tier = (rules.starting_at_higher_level ?? []).find((t) => totalLevel >= t.min_level && totalLevel <= t.max_level);
  if (!tier) return null;
  const givesSomething = tier.gold > 0 || tier.gold_roll !== undefined || (tier.magic_item_picks?.length ?? 0) > 0;
  return givesSomething ? tier : null;
}

/** L'or du palier, en po : somme fixe + somme des dés (lancés par le serveur) × multiplicateur. */
export function startingGold(tier: StartingTier, rolls: readonly number[]): number {
  const dice = rolls.reduce((sum, r) => sum + r, 0);
  return tier.gold + (tier.gold_roll ? dice * tier.gold_roll.multiplier : 0);
}
