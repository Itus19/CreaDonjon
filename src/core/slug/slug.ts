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
