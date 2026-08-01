/**
 * Derive un slug stable a partir d'un nom : minuscules, sans accents,
 * tirets pour separateurs. Pure — aucune connaissance de l'unicite, qui
 * depend de ce qui existe deja en base (src/server/services).
 */
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // diacritiques decomposes par NFD
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Suffixe a essayer apres une collision : le premier essai (attempt 0, le
 * slug de base lui-meme) n'appelle jamais cette fonction ; le deuxieme
 * essai (attempt 1) donne "-2" (le "premier doublon"), pas "-1".
 */
export function nextSlugCandidate(baseSlug: string, attempt: number): string {
  return `${baseSlug}-${attempt + 1}`;
}

/**
 * Slug numerique pour les entites (pas les mondes) : un nom peut changer a
 * tout moment (titre editable en place), un slug derive du nom au moment
 * de la creation devient alors trompeur des le premier renommage. Un
 * numero ne ment jamais puisqu'il ne represente rien d'autre que
 * lui-meme. Pure — l'unicite reelle (et la resolution des courses de
 * creation concurrente) reste du ressort de la couche service.
 */
export function nextNumericSlug(existingSlugs: string[]): string {
  const max = existingSlugs.reduce((acc, slug) => {
    if (!/^\d+$/.test(slug)) return acc;
    const n = Number(slug);
    return n > acc ? n : acc;
  }, 0);
  return String(max + 1);
}
