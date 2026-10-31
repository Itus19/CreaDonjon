import { ABILITIES, type Ability } from "@/src/core/rules/abilities";
import { pointBuyCost } from "@/src/core/rules/characterRules";

/**
 * V3.1-52 — L'étape Caractéristiques : la suggestion selon la classe, puis
 * l'échange de deux cases ; l'achat de points borné par le ruleset. Les
 * valeurs, l'ordre de la classe, le budget et les coûts viennent tous du
 * ruleset (règles de personnage, 47) : rien n'est écrit en dur ici.
 */

export type Valeurs = Record<Ability, number>;

/** Les valeurs, de la plus haute à la plus basse, dans l'ordre de la classe ; le reste dans l'ordre FOR → CHA. */
export function repartirSelonPriorite(valeurs: readonly number[], priorite: readonly Ability[]): Valeurs {
  const triees = [...valeurs].sort((a, b) => b - a);
  const ordre = [...priorite.filter((a, i) => priorite.indexOf(a) === i), ...ABILITIES.filter((a) => !priorite.includes(a))];
  return Object.fromEntries(ordre.map((a, i) => [a, triees[i]])) as Valeurs;
}

/** On touche deux cases : leurs valeurs changent de place. */
export function echangerValeurs(base: Valeurs, a: Ability, b: Ability): Valeurs {
  if (a === b) return base;
  return { ...base, [a]: base[b], [b]: base[a] };
}

interface PointBuy {
  budget: number;
  min: number;
  max: number;
  costs: Record<string, number>;
}

/** Le + : sous le plafond de l'achat, et sans dépasser le budget. */
export function peutAugmenter(base: Valeurs, a: Ability, pointBuy: PointBuy): boolean {
  if (base[a] + 1 > pointBuy.max) return false;
  return pointBuyCost({ ...base, [a]: base[a] + 1 }, pointBuy) <= pointBuy.budget;
}

/** Le − : au-dessus du plancher de l'achat. */
export function peutDiminuer(base: Valeurs, a: Ability, pointBuy: PointBuy): boolean {
  return base[a] - 1 >= pointBuy.min;
}
