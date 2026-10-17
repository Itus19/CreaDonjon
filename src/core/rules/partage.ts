/**
 * « Toute la table » (V3.1-34) : une somme d'XP ou de pièces partagée à
 * parts égales. Personne ne reçoit de fraction : ce qui ne se divise pas
 * reste au MJ, affiché, jamais distribué au hasard. Une perte se partage
 * de même (le reste garde son signe).
 */
export function partagerEgalement(total: number, personnes: number): { parPersonne: number; reste: number } {
  if (!Number.isInteger(total) || !Number.isInteger(personnes) || personnes < 1) {
    throw new RangeError("partage : une somme entière entre au moins une personne");
  }
  const parPersonne = Math.trunc(total / personnes);
  return { parPersonne, reste: total - parPersonne * personnes };
}
