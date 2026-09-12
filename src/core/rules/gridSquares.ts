/**
 * Conversion d'une distance en cases de plateau (retour utilisateur : "les
 * cases de mon plateau valent 1,5 m... toujours arrondi a la case
 * inferieure").
 *
 * Conversion d'affichage seulement, comme `ftToM`/`lbToKg` : rien n'est
 * stocke en cases, le SRD reste en pieds. On part de la valeur en METRES
 * deja affichee, et non des pieds d'origine, pour que les deux mesures de la
 * meme case de la fiche restent verifiables l'une par l'autre — un joueur
 * qui lit "9,1 m" doit pouvoir diviser par 1,5 et retrouver le meme compte.
 *
 * Pas d'epsilon : les seules frontieres exactes sont les multiples de 1,5,
 * et x,0 comme x,5 sont exactement representables en binaire — un plancher
 * naif ne peut pas basculer du mauvais cote.
 */

/** Taille d'une case du plateau de l'auteur, en metres — la case standard de D&D. */
export const SQUARE_SIZE_M = 1.5;

export function squaresFromMeters(meters: number): number {
  return Math.floor(meters / SQUARE_SIZE_M);
}
