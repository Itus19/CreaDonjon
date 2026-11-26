/**
 * AG-13 — l'ordre des pages du Livre de sessions, rangé à la main par le MJ
 * (glisser-déposer du sommaire) et repris par le wiki public. Il vit dans
 * `entities.display_order` (colonne existante, V2-G9) : plus le nombre est
 * grand, plus la page est haute. Une page neuve naît en tête
 * (`createEntity` lui donne le plus grand rang de son type, plus 1000).
 */
export interface PageDuLivre {
  displayOrder: number;
  /** `null` pour un brouillon (devoir pas encore rendu). */
  writtenAt: string | null;
}

/** Rang décroissant ; à égalité, le brouillon puis la page rendue la plus récente. */
export function trierLivre<T extends PageDuLivre>(pages: readonly T[]): T[] {
  return [...pages].sort((a, b) => {
    if (a.displayOrder !== b.displayOrder) return b.displayOrder - a.displayOrder;
    if (a.writtenAt === b.writtenAt) return 0;
    if (a.writtenAt === null) return -1;
    if (b.writtenAt === null) return 1;
    return a.writtenAt < b.writtenAt ? 1 : -1;
  });
}

/** Les rangs à écrire pour reproduire l'ordre déposé (la première page reçoit le plus grand). */
export function ordresDepuisListe(ids: readonly string[]): { id: string; displayOrder: number }[] {
  return ids.map((id, i) => ({ id, displayOrder: (ids.length - i) * 1000 }));
}

/** La dernière page rendue (le wiki public s'ouvre sur elle), indépendamment du rangement. */
export function plusRecente<T extends PageDuLivre>(pages: readonly T[]): T | null {
  let meilleure: T | null = null;
  for (const p of pages) {
    if (p.writtenAt !== null && (meilleure === null || p.writtenAt > meilleure.writtenAt!)) meilleure = p;
  }
  return meilleure;
}
