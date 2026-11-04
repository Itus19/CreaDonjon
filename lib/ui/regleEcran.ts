/**
 * V3.1-94 — logique pure de l'écran d'une règle (vue MJ) : quelles entrées le
 * menu ⋮ propose selon l'état de la fiche, et le texte du lien pour le wiki.
 * Aucun effet ici : les appels réseau vivent dans `regleApi.ts`.
 */

export type EntreeMenuRegle = "epingler" | "copierLien" | "versionMaison" | "modifier" | "briques" | "supprimer";

export interface DrapeauxRegle {
  /** Coquille joueur : ni ⋮ ni bascule (la page du joueur est le ticket V3.1-95). */
  playerRestricted: boolean;
  /** Fiche maison (créée dans la variante). */
  isHomebrew: boolean;
  /** Une version maison de la règle officielle existe déjà dans la variante active. */
  houseVersion: boolean;
  /** Le ruleset actif du monde est une base officielle : rien ne s'y écrit (règle 18). */
  isOfficialBase: boolean;
  /** Le type de la fiche a un formulaire de modification (`isEditableHomebrewType`). */
  typeModifiable: boolean;
  /** V3.1-132 : le type de la fiche se « joue » (aptitude, sort, objet magique) — l'éditeur de briques existe pour elle. */
  typeJouable?: boolean;
}

/** Les entrées du ⋮, dans l'ordre d'affichage. Vide pour le joueur. */
export function entreesMenuRegle(d: DrapeauxRegle): EntreeMenuRegle[] {
  if (d.playerRestricted) return [];
  const entrees: EntreeMenuRegle[] = ["epingler", "copierLien"];
  if (!d.isOfficialBase && !d.isHomebrew && !d.houseVersion && d.typeModifiable) entrees.push("versionMaison");
  // Sur une base officielle, la fiche n'est jamais modifiable : l'entrée n'existe pas.
  if (!d.isOfficialBase && (d.isHomebrew || d.houseVersion) && d.typeModifiable) entrees.push("modifier");
  // Même sur une base officielle : l'éditeur s'ouvre et explique qu'il faut d'abord choisir une variante.
  if (d.typeJouable) entrees.push("briques");
  if (d.isHomebrew) entrees.push("supprimer");
  return entrees;
}

/** « Modifiée dans ta variante » : un bloc modifié, ou une version maison. */
export function estModifieeDansVariante(modifiedBlockTypes: readonly string[], houseVersion: boolean): boolean {
  return modifiedBlockTypes.length > 0 || houseVersion;
}

/**
 * Le lien d'une règle à coller dans le wiki (ou ailleurs) : l'adresse complète
 * de sa page. Le wiki ne reconnaît pas de syntaxe textuelle de renvoi (les
 * renvois s'insèrent par « @ ») ; une adresse, elle, reste un lien partout.
 */
export function lienRegleWiki(origine: string, worldSlug: string, key: string): string {
  return `${origine}/m/${encodeURIComponent(worldSlug)}/regles/${encodeURIComponent(key)}`;
}
