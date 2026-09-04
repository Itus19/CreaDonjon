/**
 * Generateur compose (V1-E2/V2-J1, specs/outils-mj.md §3) — portee reduite
 * par rapport a la spec complete : pas d'`inputs`/`rule_query` (le PNJ
 * generateur qui interroge le ruleset reste hors de ce ticket), pas de
 * visibilite par emplacement, pas de promotion en entite (mecanisme
 * generique pas encore ecrit). Chaque emplacement `table` tire une fois sur
 * une `random_table` de la MEME entite (meme discipline que la cascade de
 * V1-E1), et le gabarit assemble les textes tires.
 *
 * V2-J1 ajoute l'emplacement `prose` : un paragraphe redige par l'IA a
 * partir des emplacements `table` deja tires (jamais l'inverse — la prose
 * reagit aux valeurs, jamais les valeurs a la prose). Sans fournisseur IA
 * configure, un emplacement `prose` reste simplement vide — le reste du
 * tirage (tous les emplacements `table`) fonctionne a l'identique.
 */

/**
 * Filtre par palier applique a la table d'un emplacement AVANT le tirage
 * (V2-J9quater, "un fonctionnement qui marche partout pareil" — retour
 * utilisateur). La table elle-meme porte TOUTES les entrees, tous paliers
 * confondus (`TableEntry.tier`, src/core/tables/types.ts) ; c'est ce
 * filtre qui decide lesquelles sont eligibles pour CE tirage precis.
 */
export interface GeneratorTableSlotTier {
  /** Cle de l'axe de variante de l'outil (ex. "wealth") dont la valeur resolue pilote le filtre. */
  axis: string;
  /**
   * `"exact"` : ne garde que les entrees dont `tier` correspond a `target`
   * une fois interpole (ex. "{wealth_below}" — le Menu de Taverne veut 3
   * points de prix distincts, pas une plage). `"ceiling"` : garde toute
   * entree dont le palier est <= la valeur resolue de l'axe (un objet rare
   * n'apparait jamais dans un contexte modeste, mais un objet commun reste
   * toujours possible dans un contexte reputee) — `target` est alors ignore.
   */
  match: "exact" | "ceiling";
  /** Gabarit interpolable avec les memes cles que `GeneratorTableSlot.table` (ex. "{wealth}") — requis seulement pour `match: "exact"`. */
  target?: string;
}

export interface GeneratorTableSlot {
  key: string;
  /** Cle d'un bloc `random_table` porte par la meme entite (src/core/tables/types.ts RandomTableData.key). */
  table: string;
  /**
   * Nombre de resultats a tirer sur la MEME table pour cet emplacement
   * (V2-J9, ex. un menu de taverne : 5 plats en un seul emplacement plutot
   * que 5 emplacements identiques) — reutilise `drawMultiple` deja
   * existant (src/core/tables/roll.ts), qui respecte deja `unique_draws`.
   * Absent ou <= 1 : un seul tirage, comportement inchange.
   */
  count?: number;
  /** Filtre par palier (V2-J9quater) — absent : toutes les entrees de la table restent eligibles, comportement inchange. */
  tier?: GeneratorTableSlotTier;
}

export interface GeneratorProseSlot {
  key: string;
  /**
   * Consigne envoyee au modele (ex. "Decris l'ambiance de cette taverne,
   * prete a etre lue a voix haute") — jamais un prompt systeme complet,
   * une phrase courte que l'auteur du generateur ecrit une fois. Les
   * emplacements `table` deja tires sont transmis a part, en donnee
   * encadree (CLAUDE.md regle 8), jamais interpoles directement dans cette
   * consigne.
   */
  prose: string;
}

export type GeneratorSlot = GeneratorTableSlot | GeneratorProseSlot;

export function isProseSlot(slot: GeneratorSlot): slot is GeneratorProseSlot {
  return "prose" in slot;
}

export interface GeneratorData {
  /**
   * Cle technique stable du bloc au sein d'une meme entite (meme convention
   * que `RandomTableData.key`, src/core/tables/types.ts) — optionnelle : un
   * generateur ponctuel de fiche ("+ Générateur") n'en a jamais besoin, il
   * est retrouve directement par son blockId. Sert uniquement quand
   * plusieurs generateurs coexistent sur une meme entite et doivent etre
   * adresses par cle plutot que par id (V2-J1 Phase 2, sections d'un outil
   * MJ decompose — chaque section est un bloc `generator` avec sa propre
   * cle sur l'entite "Générateurs de MJ").
   */
  key?: string;
  slots: GeneratorSlot[];
  /** Texte avec des emplacements `{cle}` a interpoler (src/core/generators/render.ts) — un emplacement `prose` s'y interpole comme n'importe quel autre, une fois redige. */
  template: string;
}

/** Longueur cible d'un emplacement `prose`, choisie par l'auteur au moment de generer (retour utilisateur explicite — jamais figee dans le bloc). */
export const PROSE_LENGTH_PRESETS = [30, 100, 250] as const;
export type ProseLength = (typeof PROSE_LENGTH_PRESETS)[number];
export const DEFAULT_PROSE_LENGTH: ProseLength = 100;
