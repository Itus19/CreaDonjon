/**
 * Nom d'une entite personnage (V3.1-48) : « Prenom Nom », compose depuis les
 * deux champs du bloc `character`. Chaine vide si les deux sont vides —
 * l'appelant garde alors le nom deja porte par l'entite.
 */
export function composeCharacterName(givenName: string | undefined, familyName: string | undefined): string {
  return [givenName, familyName]
    .map((part) => (part ?? "").trim())
    .filter((part) => part !== "")
    .join(" ");
}
