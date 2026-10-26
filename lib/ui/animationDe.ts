/**
 * V3.1-75 — ce que l'animation de dé a de commun (outil de dés V3.1-33 et
 * Table aléatoire) : les durées, et la préférence de mouvement réduit. Sortis
 * d'`OutilDes.tsx` pour être partagés SANS copie.
 */

/** La préférence système « réduire les animations ». */
export const REDUIT_QUERY = "(prefers-reduced-motion: reduce)";
/** Délai entre deux dés qui se figent. */
export const PAS_FIGE_MS = 110;
/** Attente minimale avant de figer : le scintillement doit se voir même si le serveur répond vite. */
export const ATTENTE_MIN_MS = 450;
/** Cadence des chiffres flous qui défilent (décoratifs). */
export const RAFRAICHISSEMENT_BRUIT_MS = 70;

/** `matchMedia` réduit à ce qu'on lui demande, pour tester sans navigateur. */
type MatchMediaLike = (requete: string) => { matches: boolean };

/** Vrai si l'utilisateur demande moins de mouvement. Sans `matchMedia` (serveur), faux : le rendu serveur ne s'anime pas. */
export function mouvementReduit(matchMedia: MatchMediaLike | undefined): boolean {
  return matchMedia ? matchMedia(REDUIT_QUERY).matches : false;
}

/** Combien de temps attendre avant d'afficher la réponse du serveur : rien en mouvement réduit, sinon l'attente minimale. */
export function attenteMinimale(reduit: boolean): number {
  return reduit ? 0 : ATTENTE_MIN_MS;
}
