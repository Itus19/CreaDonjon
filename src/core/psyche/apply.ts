/**
 * Amortissement des mouvements de pôle/axe (V2-H1, specs/psyche-pnj.md
 * §1.5). Fonction pure : `deltas`/`axes` stockent toujours le BRUT, jamais
 * l'effectif — rejouer le journal doit reproduire exactement la valeur
 * courante, donc cette fonction est réappliquée à chaque rejeu, jamais son
 * résultat mémorisé à part.
 *
 * S'éloigner du centre s'amortit (plus la valeur est extrême, moins un
 * delta de même signe fait effet) ; y revenir garde son plein effet.
 * `current === 0` compte comme « s'éloigne » quel que soit le signe du
 * delta — à l'amortissement nul (facteur 1) puisque `abs(0) / 100 === 0`,
 * donc le comportement à zéro est déjà le plein effet, sans cas spécial.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function applyDelta(current: number, delta: number): number {
  const movingAway = Math.sign(delta) === Math.sign(current) || current === 0;
  const effective = movingAway ? delta * (1 - Math.abs(current) / 100) : delta;
  return clamp(Math.round(current + effective), -100, 100);
}

/** Rejoue une série de deltas bruts (ordre chronologique) depuis 0 — reconstruit une valeur courante exactement, jamais un raccourci de somme. */
export function replayDeltas(deltas: number[]): number {
  return deltas.reduce((current, delta) => applyDelta(current, delta), 0);
}
