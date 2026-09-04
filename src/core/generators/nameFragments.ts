/**
 * Assemblage de prenoms par fragments (retour utilisateur — meme principe
 * "debut + fin, parfois un milieu" observe sur dd2024.fr, mots et code
 * originaux, aucun contenu importe). `GENERATOR_TOOLS`/`generators.ts`
 * pilotent le tirage des fragments eux-memes (tables `random_table`
 * ordinaires) ; ce module ne fait QUE les recoller de facon prononcable.
 */

const VOWELS = /[aeiouyàâäéèêëîïôöùûüœæ]/i;

function endsWithVowel(s: string): boolean {
  return VOWELS.test(s.at(-1) ?? "");
}

function startsWithVowel(s: string): boolean {
  return VOWELS.test(s[0] ?? "");
}

/**
 * Recolle deux fragments en evitant les chocs de son. Alternance naturelle
 * (l'un finit par une voyelle, l'autre commence par une consonne, ou
 * l'inverse) : simple concatenation. Meme nature aux deux bouts (deux
 * voyelles qui se suivraient mal, ou deux consonnes) : une lettre de
 * liaison ("l" entre deux voyelles, "a" entre deux consonnes) plutot qu'un
 * assemblage imprononcable.
 */
export function joinNameFragments(a: string, b: string): string {
  if (endsWithVowel(a) !== startsWithVowel(b)) return a + b;
  return endsWithVowel(a) ? `${a}l${b}` : `${a}a${b}`;
}

/** Compose un prenom complet : debut + (optionnel) milieu + fin. `mid` absent/null : pas de fragment central, comportement le plus frequent (retour utilisateur — la majorite des prenoms restent debut+fin). */
export function composeFragmentName(start: string, mid: string | null, end: string): string {
  const withMid = mid ? joinNameFragments(start, mid) : start;
  return joinNameFragments(withMid, end);
}
