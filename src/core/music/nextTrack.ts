/**
 * Quelle piste jouer apres celle qui vient de finir (V2.1-6, lot 2) —
 * `null` pour se taire.
 *
 * Le lot 2 s'arretait en fin de liste, avec une note explicite : « pas de
 * boucle, a demander a l'auteur si le besoin apparait ». Il est apparu. La
 * decision sort donc du fournisseur de contexte pour vivre ici : c'est une
 * regle, pas de la plomberie React, et elle a assez de cas limites (piste
 * unique, liste vide, index devenu hors liste parce qu'on a retire une piste
 * en cours de lecture) pour meriter d'etre eprouvee sans navigateur.
 */
export function nextTrackIndex(currentIndex: number, trackCount: number, loop: boolean): number | null {
  if (trackCount <= 0) return null;
  const suivant = currentIndex + 1;
  if (suivant < trackCount) return suivant;
  // Fin de liste — ou index deja hors liste, si une piste a disparu pendant
  // la lecture. Dans les deux cas, boucler veut dire repartir du debut, et ne
  // pas boucler veut dire se taire plutot que rejouer une piste au hasard.
  return loop ? 0 : null;
}
