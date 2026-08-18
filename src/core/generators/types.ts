/**
 * Generateur compose (V1-E2, specs/outils-mj.md §3) — portee volontairement
 * reduite par rapport a la spec complete : pas d'`inputs`/`rule_query` (le
 * PNJ generateur qui interroge le ruleset reste V2, hors des trois cas
 * concrets de ce ticket — noms, rumeurs, butin), pas de visibilite par
 * emplacement (aucun des trois cas n'a besoin d'un secret MJ), pas de
 * promotion en entite (V1-E6, mecanisme generique pas encore ecrit). Chaque
 * emplacement tire une fois sur une table `random_table` de la MEME entite
 * (meme discipline que la cascade de V1-E1), et le gabarit assemble les
 * textes tires.
 */

export interface GeneratorSlot {
  key: string;
  /** Cle d'un bloc `random_table` porte par la meme entite (src/core/tables/types.ts RandomTableData.key). */
  table: string;
}

export interface GeneratorData {
  slots: GeneratorSlot[];
  /** Texte avec des emplacements `{cle}` a interpoler (src/core/generators/render.ts). */
  template: string;
}
