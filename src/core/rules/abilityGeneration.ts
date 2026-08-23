import type { Ability } from "./sheet";

/**
 * Les trois methodes d'attribution des caracteristiques a la creation
 * (`character.abilities.method`, specs/wiki-liens-et-personnages.md §B8
 * etape 3) : tableau standard, achat de points, tirage. Constantes
 * officielles PHB — aucune valeur inventee.
 */
export const STANDARD_ARRAY: readonly number[] = [15, 14, 13, 12, 10, 8];

export const POINT_BUY_BUDGET = 27;
export const POINT_BUY_MIN = 8;
export const POINT_BUY_MAX = 15;

/** Cout par valeur (8 a 15), non lineaire au-dela de 13 — table officielle PHB. */
const POINT_BUY_COST: Record<number, number> = {
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 7,
  15: 9,
};

/** Nombre de des a tirer par caracteristique en methode "roll" (4d6, on garde les 3 meilleurs). */
export const ROLL_DICE_COUNT = 4;
export const ROLL_DICE_FACES = 6;
export const ROLL_KEEP_HIGHEST = 3;

/**
 * Cout total d'une repartition en achat de points. `Infinity` pour toute
 * valeur hors bornes (8-15) plutot qu'un cout invente — l'appelant compare
 * simplement au budget, une valeur hors bornes ne peut alors jamais passer
 * pour valide.
 */
export function pointBuyCost(scores: Record<Ability, number>): number {
  return (Object.values(scores) as number[]).reduce((sum, score) => {
    const cost = POINT_BUY_COST[score];
    return sum + (cost ?? Infinity);
  }, 0);
}
