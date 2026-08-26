/**
 * Seuils de PX cumules par niveau total (regle officielle 5e, identique
 * SRD 2014/2024). Sert uniquement a dessiner une barre de progression —
 * aucune montee de niveau n'est automatisee a partir de ces valeurs.
 */
export const XP_LEVEL_THRESHOLDS: readonly number[] = [
  0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000,
  265000, 305000, 355000,
];

/** Seuil de PX du niveau suivant. `null` au niveau maximum (20) — pas de niveau suivant. */
export function nextLevelThreshold(totalLevel: number): number | null {
  return XP_LEVEL_THRESHOLDS[totalLevel] ?? null;
}

/** Le PX actuel justifie-t-il de passer au niveau suivant (V2-G1, montee de niveau accompagnee) ? */
export function hasReachedNextLevel(totalLevel: number, xpCurrent: number): boolean {
  const threshold = nextLevelThreshold(totalLevel);
  return threshold !== null && xpCurrent >= threshold;
}
