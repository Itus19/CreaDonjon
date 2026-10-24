/** Les quatre modes d'affichage, du plus sombre au plus clair. */
export const MODES_APPARENCE = ["dark", "dim", "soft", "light"] as const;

/**
 * Le mode après le choix d'un fond (V3.1-58) : celui en cours s'il reste
 * lisible sur ce fond, sinon le premier que le fond permet. `bascule` dit
 * s'il faut l'annoncer à la personne.
 */
export function modeApresChoixDeFond(modeCourant: string, modesPermis: readonly string[]): { mode: string; bascule: boolean } {
  const repli = modesPermis[0];
  if (modesPermis.includes(modeCourant) || !repli) return { mode: modeCourant, bascule: false };
  return { mode: repli, bascule: true };
}

/** Un point par mode, dans l'ordre : teinté si le fond le permet, vide sinon. */
export function pointsDeModes(modesPermis: readonly string[]): { mode: (typeof MODES_APPARENCE)[number]; permis: boolean }[] {
  return MODES_APPARENCE.map((mode) => ({ mode, permis: modesPermis.includes(mode) }));
}
