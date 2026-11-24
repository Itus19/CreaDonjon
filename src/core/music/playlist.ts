/**
 * AG-20 — une playlist YouTube jouée morceau par morceau. Le lecteur pilote
 * (ADR 0022) lit la liste des vidéos de la playlist, puis joue chacune à son
 * tour : c'est ce qui permet « Précédent · Suivant » et la liste cliquable.
 */

/** L'index où commencer : la vidéo du lien (`watch?v=…&list=…`) si elle est dans la liste, sinon la première. */
export function indexDepart(ids: readonly string[], videoDuLien: string | null): number {
  if (videoDuLien === null) return 0;
  const i = ids.indexOf(videoDuLien);
  return i === -1 ? 0 : i;
}

/**
 * Le morceau voisin : `sens` 1 pour le suivant (`null` après le dernier, la
 * playlist est finie), -1 pour le précédent (le premier reste le premier).
 */
export function morceauVoisin(index: number, total: number, sens: 1 | -1): number | null {
  if (total <= 0) return null;
  if (sens === -1) return Math.max(0, Math.min(index, total) - 1);
  const suivant = index + 1;
  return suivant < total ? suivant : null;
}
