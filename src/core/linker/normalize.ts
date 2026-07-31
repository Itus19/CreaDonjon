const COMBINING_MARKS = /[̀-ͯ]/g;

function normalizeChar(char: string): string {
  return char.toLowerCase().normalize("NFD").replace(COMBINING_MARKS, "");
}

/**
 * Normalise insensible a la casse et aux accents, caractere par caractere,
 * pour garder le meme alignement d'index que le texte original — sans
 * quoi les positions start/end rapportees par detectEntityReferences ne
 * correspondraient plus au texte source. `normalize("NFC")` prealable
 * recompose les sequences deja decomposees (accent tape separement de sa
 * lettre) pour que chaque caractere source produise exactement un
 * caractere normalise.
 */
export function normalizeForMatching(text: string): string {
  return Array.from(text.normalize("NFC")).map(normalizeChar).join("");
}
