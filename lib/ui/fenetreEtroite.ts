/**
 * V3.1-95 : « fenêtre étroite » de la zone des règles. Le même seuil que le
 * tiroir ☰ du sommaire (V3.1-93, `@[48rem]` de `WindowsDesktop`) : on le lit
 * sur la largeur du CONTENEUR, jamais sur celle de l'écran. Sous ce seuil, un
 * renvoi s'ouvre en panneau opaque par-dessus la page.
 */
export const SEUIL_FENETRE_ETROITE_REM = 48;

/** Largeur (px) du panneau de renvoi. */
export const LARGEUR_PANNEAU_RENVOI = 340;

/** Vrai si un conteneur de `largeurPx` est plus étroit que le seuil (rem converti avec la taille de police racine). */
export function estFenetreEtroite(largeurPx: number, remPx = 16): boolean {
  return largeurPx < SEUIL_FENETRE_ETROITE_REM * remPx;
}
