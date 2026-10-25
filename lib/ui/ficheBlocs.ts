/**
 * V3.1-63 — noyau pur de la fiche du wiki sur ordinateur : la palette
 * « Ajouter un bloc » rangée en familles, et le texte des annonces du
 * réordonnancement au clavier (⠿ + flèches + Entrée / Échap). Le composant
 * ne fait que brancher : l'ordre des familles, les exclusions et la
 * position annoncée se décident ici, testés sans navigateur.
 */

export type CleFamille = "recit" | "personnage" | "psyche" | "outils";

export interface FamillePalette {
  cle: CleFamille;
  types: readonly string[];
}

/** Les quatre familles, dans l'ordre de la planche `Wiki-Fiche-Decide`. */
export const FAMILLES_PALETTE: readonly FamillePalette[] = [
  { cle: "recit", types: ["text", "infobox", "image", "custom_table", "timeline"] },
  { cle: "personnage", types: ["character", "inventory", "spellcasting", "resources", "statblock"] },
  { cle: "psyche", types: ["personality", "relationship", "worldview", "relations_graph", "genealogy"] },
  { cle: "outils", types: ["random_table", "quest", "music", "map"] },
];

/**
 * Types qui existent mais ne se posent jamais à la main depuis la palette :
 * le générateur vit dans la barre MJ, `note_tree` dans le Bloc-notes, et
 * `session_journal_meta` est posé par le Livre de sessions.
 */
export const TYPES_HORS_PALETTE: readonly string[] = ["generator", "note_tree", "session_journal_meta"];

/** Un seul exemplaire par fiche (index `blocks_personality_worldview_uniq`). */
const TYPES_UNIQUES: readonly string[] = ["personality", "worldview"];

/**
 * Les familles proposées pour une fiche donnée : sans les types déjà
 * présents quand ils sont uniques, restreintes aux types permis (coquille
 * joueur), et sans famille vide.
 */
export function famillesAjoutables(
  blocs: readonly { blockType: string }[],
  typesPermis?: readonly string[],
): FamillePalette[] {
  return FAMILLES_PALETTE.map((famille) => ({
    cle: famille.cle,
    types: famille.types.filter(
      (type) =>
        (!typesPermis || typesPermis.includes(type)) &&
        !(TYPES_UNIQUES.includes(type) && blocs.some((b) => b.blockType === type)),
    ),
  })).filter((famille) => famille.types.length > 0);
}

/** Position (1 = premier) du bloc `idActif` une fois posé sur la place de `idCible`. `null` si le bloc est inconnu. */
export function positionApresDeplacement(
  ids: readonly string[],
  idActif: string,
  idCible: string | null,
): { position: number; total: number } | null {
  const de = ids.indexOf(idActif);
  if (de === -1) return null;
  const vers = idCible === null ? -1 : ids.indexOf(idCible);
  const arrivee = vers === -1 ? de : vers;
  return { position: arrivee + 1, total: ids.length };
}

export type EtapeReordonnancement = "prise" | "deplace" | "posee" | "annulee";

export interface AnnonceReordonnancement {
  cle: EtapeReordonnancement;
  bloc: string;
  position: number;
  total: number;
}

/**
 * Ce que le lecteur d'écran doit entendre à chaque étape du glisser au
 * clavier ; le composant traduit `cle` en phrase (messages/ `fiche`).
 */
export function annonceReordonnancement(
  etape: EtapeReordonnancement,
  ids: readonly string[],
  libelles: Readonly<Record<string, string>>,
  idActif: string,
  idCible: string | null,
): AnnonceReordonnancement | null {
  const position = positionApresDeplacement(ids, idActif, idCible);
  if (!position) return null;
  return { cle: etape, bloc: libelles[idActif] ?? "", ...position };
}
