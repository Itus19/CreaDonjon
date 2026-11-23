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

export interface JaugeXp {
  /** PX gagnés depuis le seuil du niveau actuel, jamais négatif. */
  dansNiveau: number;
  /** PX qui séparent le niveau actuel du suivant (0 au niveau 20). */
  versSuivant: number;
  /** Part remplie de la jauge, de 0 à 100. */
  pourcentage: number;
  /** PX cumulés : ce que la règle compte, montré au survol. */
  total: number;
  niveauSuivant: number | null;
}

/**
 * AG-4 — ce que montre la jauge d'XP. En D&D les PX se cumulent et ne
 * repartent jamais à zéro : 900 PX est le seuil du niveau 3. Afficher ce
 * total juste après une montée de niveau donne l'impression que rien n'a
 * bougé ; on montre donc le chemin vers le niveau suivant, depuis le seuil du
 * niveau actuel, et le total à part. Un personnage créé au niveau 3 avec 0 PX
 * (sous le seuil) affiche 0, pas -900.
 */
export function jaugeXp(totalLevel: number, xpCurrent: number): JaugeXp {
  const niveau = Math.max(1, Math.min(totalLevel, XP_LEVEL_THRESHOLDS.length));
  const plancher = XP_LEVEL_THRESHOLDS[niveau - 1] ?? 0;
  const plafond = nextLevelThreshold(niveau);
  if (plafond === null) {
    return { dansNiveau: 0, versSuivant: 0, pourcentage: 100, total: xpCurrent, niveauSuivant: null };
  }
  const versSuivant = plafond - plancher;
  const dansNiveau = Math.max(0, xpCurrent - plancher);
  const pourcentage = Math.min(100, Math.round((dansNiveau / versSuivant) * 100));
  return { dansNiveau, versSuivant, pourcentage, total: xpCurrent, niveauSuivant: niveau + 1 };
}
