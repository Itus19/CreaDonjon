/**
 * Logique pure de la feuille du bas (V3.1-29) : le composant
 * (`components/shared/FeuilleDuBas.tsx`) ne fait que brancher les evenements
 * du navigateur sur ces fonctions, qui se testent sans DOM.
 */

/** Distance de glisse (px) au-dela de laquelle relacher ferme la feuille. */
export const SEUIL_FERMETURE_PX = 80;

/** Vitesse (px par ms) au-dela de laquelle un geste vers le bas ferme meme court : 0,5 px/ms = 500 px/s. */
export const VITESSE_FERMETURE_PX_PAR_MS = 0.5;

/** Distance minimale (px) pour qu'un geste rapide compte : un frolement de 2 px en 1 ms n'est pas une intention. */
const DISTANCE_MINIMALE_GESTE_PX = 24;

/** Decalage de la feuille pendant la glisse : elle suit le doigt vers le bas, jamais vers le haut. */
export function decalageGlisse(departY: number, courantY: number): number {
  return Math.max(0, courantY - departY);
}

/** Relache apres une glisse : ferme au-dela du seuil de distance, ou sur un geste vers le bas net et vif. */
export function doitFermerApresGlisse(distance: number, dureeMs: number): boolean {
  if (distance > SEUIL_FERMETURE_PX) return true;
  if (distance < DISTANCE_MINIMALE_GESTE_PX) return false;
  return distance / Math.max(dureeMs, 1) > VITESSE_FERMETURE_PX_PAR_MS;
}

/**
 * Piege du focus : index de l'element a focaliser apres Tab (ou Maj+Tab) parmi
 * `total` elements focalisables, en bouclant. `courant` vaut -1 quand le focus
 * est hors de la feuille. Renvoie -1 s'il n'y a aucun element.
 */
export function indexFocusSuivant(courant: number, total: number, versArriere: boolean): number {
  if (total <= 0) return -1;
  if (courant < 0) return versArriere ? total - 1 : 0;
  return (courant + (versArriere ? -1 : 1) + total) % total;
}
