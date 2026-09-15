/**
 * V2.1-11 lot 3 — parallaxe d'une image de bloc au defilement.
 *
 * Le calcul vit ici parce qu'il est faux de trois facons differentes si on
 * l'ecrit a la main dans un composant : borne oubliee (l'image sort de son
 * cadre sur une fiche longue), division par zero (fenetre de hauteur nulle au
 * premier rendu), decalage fractionnaire (le texte voisin vibre). Trois
 * defauts qui demandent un navigateur ET un long defilement pour se montrer,
 * alors qu'ils s'eprouvent ici en millisecondes.
 *
 * La mecanique, en une phrase : l'image est plus HAUTE que son cadre d'un
 * montant `travel`, et glisse vers le haut de 0 a `travel` pendant que le
 * cadre traverse la fenetre. C'est ce qui garantit qu'aucun vide n'apparait,
 * et c'est aussi ce qui impose que **l'image soit rognee** — compromis
 * confirme par l'auteur : la parallaxe convient a une illustration d'ambiance,
 * jamais a une carte ou un plan qu'on veut voir en entier.
 */

const INTENSITE_MAX = 40;

/**
 * Ou en est le cadre dans sa traversee de la fenetre, de 0 (il touche le bas)
 * a 1 (il vient de sortir par le haut).
 *
 * `frameTop` est la valeur de `getBoundingClientRect().top` — relative a la
 * FENETRE, jamais au document. C'est ce qui rend le calcul indifferent a
 * l'element qui defile reellement : la coquille de l'application fait defiler
 * un conteneur interne, pas `window`.
 */
export function parallaxProgress({
  frameTop,
  frameHeight,
  viewportHeight,
}: {
  frameTop: number;
  frameHeight: number;
  viewportHeight: number;
}): number {
  const course = viewportHeight + frameHeight;
  if (course <= 0) return 0;
  const brut = (viewportHeight - frameTop) / course;
  return Math.min(1, Math.max(0, brut));
}

/** Hauteur excedentaire de l'image par rapport a son cadre, en pixels. */
export function parallaxTravelPx(frameHeight: number, intensityPct: number): number {
  const intensite = Math.min(INTENSITE_MAX, Math.max(0, intensityPct));
  return Math.round((frameHeight * intensite) / 100);
}

/** Decalage vertical a appliquer a l'image, toujours negatif ou nul (elle monte). */
export function parallaxShiftPx(progress: number, travelPx: number): number {
  const px = Math.round(progress * travelPx);
  // `-0` plutot que `0` sinon : sans interet au rendu (`translate3d(0,-0px,0)`
  // est valide), mais il se propage dans les comparaisons et les tests.
  return px === 0 ? 0 : -px;
}
