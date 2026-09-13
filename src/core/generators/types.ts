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
  /**
   * Cle de l'axe de variante de l'outil (ex. "wealth") dont la valeur
   * resolue pilote le filtre — ou, si `fromSlot` est vrai, la CLE D'UN
   * AUTRE EMPLACEMENT de ce meme generateur (ex. "mot") : le filtre
   * utilise alors le `tier` REELLEMENT tire par cet emplacement, jamais
   * une valeur choisie par le MJ. Cet autre emplacement doit apparaitre
   * AVANT celui-ci dans `slots` (l'auteur du generateur ordonne, l'outil
   * ne verifie pas) — meme discipline que `origine`/`tournant` deja
   * chaines par gabarit sans verification moteur.
   */
  axis: string;
  /**
   * `"exact"` : ne garde que les entrees dont `tier` correspond a `target`
   * une fois interpole (ex. "{wealth_below}" — le Menu de Taverne veut 3
   * points de prix distincts, pas une plage). `"ceiling"` : garde toute
   * entree dont le palier est <= la valeur resolue de l'axe (un objet rare
   * n'apparait jamais dans un contexte modeste, mais un objet commun reste
   * toujours possible dans un contexte reputee) — `target` est alors ignore.
   * `fromSlot` impose `"exact"` : un accord grammatical est binaire (le
   * genre d'un adjectif correspond ou non a celui du nom), jamais un plafond.
   */
  match: "exact" | "ceiling";
  /** Gabarit interpolable avec les memes cles que `GeneratorTableSlot.table` (ex. "{wealth}") — requis seulement pour `match: "exact"` ET `fromSlot` absent (le mot-cle d'un `fromSlot` vient du tirage, jamais d'un gabarit). */
  target?: string;
  /**
   * Accord entre deux emplacements du meme generateur (retour utilisateur
   * — noms d'echoppe "mot-theme + adjectif accorde", ex. "La Forge
   * Ardente"/"Le Marteau Poli") plutot qu'un axe de variante choisi par le
   * MJ. `axis` designe alors la CLE d'un emplacement precedent, pas un axe
   * du registre de l'outil. Absent (ou faux) : comportement inchange,
   * `axis` reste un axe de variante (V2-J9quater d'origine).
   */
  fromSlot?: boolean;
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

/**
 * Emplacement compose par fragments (retour utilisateur — prenoms qui
 * "sonnent selon la race et le genre", meme principe debut+fin observe sur
 * dd2024.fr, mots et code originaux). `starts`/`ends` obligatoires,
 * `mids` optionnelle : le tirage n'utilise un fragment central que dans
 * une minorite de cas (`src/server/services/generators.ts`), la plupart
 * des noms restent debut+fin. Les trois cles designent des blocs
 * `random_table` de la MEME entite, memes conventions qu'un `table`
 * ordinaire. Recollage prononcable via `joinNameFragments`
 * (`src/core/generators/nameFragments.ts`), jamais une simple
 * concatenation brute.
 */
export interface GeneratorFragmentNameSlot {
  key: string;
  fragments: {
    starts: string;
    mids?: string;
    ends: string;
  };
  /** Filtre par palier applique SEULEMENT a la table `ends` (retour utilisateur, genre du prenom : masculin/feminin/neutre) — meme forme que `GeneratorTableSlotTier`, jamais `fromSlot` ici : le genre vient d'un axe de variante choisi par le MJ (V2-J7), pas du tirage d'un autre emplacement. */
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

export type GeneratorSlot = GeneratorTableSlot | GeneratorFragmentNameSlot | GeneratorProseSlot;

export function isProseSlot(slot: GeneratorSlot): slot is GeneratorProseSlot {
  return "prose" in slot;
}

export function isFragmentNameSlot(slot: GeneratorSlot): slot is GeneratorFragmentNameSlot {
  return "fragments" in slot;
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
