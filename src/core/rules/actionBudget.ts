import { z } from "zod";

/**
 * V3-A3 — L'economie d'action (specs/moteur-de-jeu.md §5).
 *
 * Module PUR, et volontairement minuscule. Sa seule idee difficile tient en
 * une phrase de la spec :
 *
 *   « Signaler, ne pas interdire. Une action sans budget est marquee
 *     "hors budget" et reste jouable. Les tables derogent en permanence ;
 *     un outil qui bloque devient un outil qu'on contourne. »
 *
 * D'ou l'absence totale de garde : `spendFromBudget` ne refuse jamais rien
 * et ne leve jamais. Le budget descend en NEGATIF, ce qui est justement le
 * signal. Un plancher a zero serait pire qu'inutile — il effacerait
 * l'information qu'on voulait porter.
 */

export const BUDGET_KINDS = ["action", "bonus", "reaction", "movement", "free"] as const;
export type BudgetKind = (typeof BUDGET_KINDS)[number];

export interface ActionBudget {
  action: number;
  bonus: number;
  reaction: number;
  /** En metres, derive de la vitesse — jamais en cases : il n'y a pas de grille (ADR de la V3, spec §6). */
  movement: number;
  free: number;
}

export const zActionBudget = z.object({
  // `int()` sans `nonnegative()` : un budget depasse est un etat LEGITIME,
  // c'est meme tout le mecanisme. Le refuser ici rendrait la scene
  // insauvegardable des qu'une table deroge.
  action: z.number().int(),
  bonus: z.number().int(),
  reaction: z.number().int(),
  movement: z.number().int(),
  free: z.number().int(),
});

/** Budget d'un tour neuf. Appele a `turn_start` — c'est le moteur qui le remet a zero, jamais le joueur ni un modele. */
export function budgetForTurn(speed: number): ActionBudget {
  return { action: 1, bonus: 1, reaction: 1, movement: speed, free: 1 };
}

/**
 * Depense. Rend TOUJOURS un budget, plus un drapeau disant si cette
 * depense-la a fait passer la categorie en dessous de zero.
 *
 * `overBudget` porte sur la categorie touchee, pas sur le budget entier :
 * l'interface doit pouvoir marquer LA ligne fautive, pas le tour.
 */
export function spendFromBudget(
  budget: ActionBudget,
  kind: BudgetKind,
  amount = 1
): { budget: ActionBudget; overBudget: boolean } {
  const next = { ...budget, [kind]: budget[kind] - amount };
  return { budget: next, overBudget: next[kind] < 0 };
}

/** Accorde (montant positif) ou retire (negatif) du budget — « Fougue du guerrier », ecrite en donnees. */
export function grantToBudget(budget: ActionBudget, kind: BudgetKind, amount: number): ActionBudget {
  return { ...budget, [kind]: budget[kind] + amount };
}

/** Vrai des qu'une categorie est dans le rouge. Pour l'affichage, jamais pour bloquer. */
export function isOverBudget(budget: ActionBudget): boolean {
  return BUDGET_KINDS.some((kind) => budget[kind] < 0);
}
