import type { Concentration } from "../schemas/runtimeState";

/**
 * Concentration (V3.1-24, ADR 0036 §3). Le champ `concentration` de l'etat de
 * jeu est la SEULE verite ; l'etat `concentrating` que lisent les declencheurs
 * en est derive, jamais stocke en double (regle 16).
 *
 * `applyConcentrationChange` est le POINT UNIQUE de rupture : lancer un sort de
 * concentration (qui remplace la precedente) et « Rompre » passent tous deux
 * par lui, et il rend ce qui a ete rompu. C'est la que se branchera le retrait
 * des effets durables de concentration (ADR 0060, V3.1-130) — aucun autre
 * chemin ne doit retirer une concentration.
 */
export const CONCENTRATING = "concentrating";

export interface ConcentrationChange {
  next: Concentration | null;
  /** Ce qui s'est rompu dans ce changement (l'ancienne concentration remplacee ou retiree), `null` s'il n'y avait rien. */
  broken: Concentration | null;
}

function sameConcentration(a: Concentration, b: Concentration): boolean {
  return a.spell_key !== null ? a.spell_key === b.spell_key : b.spell_key === null && a.label === b.label;
}

/** `incoming` = la nouvelle concentration, ou `null` pour rompre. */
export function applyConcentrationChange(current: Concentration | null, incoming: Concentration | null): ConcentrationChange {
  if (current === null) return { next: incoming, broken: null };
  if (incoming !== null && sameConcentration(current, incoming)) return { next: current, broken: null };
  return { next: incoming, broken: current };
}

/** Les conditions vues par les declencheurs : celles de la fiche, plus `concentrating` si une concentration est en cours. */
export function concentratingConditions(conditions: readonly string[], concentration: Concentration | null): string[] {
  if (concentration === null || conditions.includes(CONCENTRATING)) return [...conditions];
  return [...conditions, CONCENTRATING];
}
