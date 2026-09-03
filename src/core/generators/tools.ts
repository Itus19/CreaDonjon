/**
 * Registre des outils de generation MJ decomposes (V2-J1 Phase 2,
 * specs/outils-mj.md §3) — associe un `toolKey` ("taverne") a la liste
 * ordonnee de ses sections. Chaque section EST un bloc `generator` (cf.
 * src/core/generators/types.ts) porte par l'entite "Générateurs de MJ" de
 * chaque monde (une par monde, auto-provisionnee — voir
 * `ensureGeneratorToolsEntity`, src/server/services/entities.ts), retrouve
 * par sa cle technique (`GeneratorData.key`) plutot que par son blockId :
 * ajouter Échoppe/PNJ/Noms plus tard ne touchera que ce registre + du
 * contenu de table, jamais le moteur ni la plomberie de fenetre.
 *
 * Les cles de section sont prefixees par le `toolKey` (ex.
 * "taverne-etablissement") pour rester uniques sur l'entite partagee, qui
 * portera a terme les blocs de plusieurs outils.
 */

export interface GeneratorToolSectionConfig {
  key: string;
  label: string;
}

export interface GeneratorToolConfig {
  key: string;
  label: string;
  sections: readonly GeneratorToolSectionConfig[];
}

export const GENERATOR_TOOLS: readonly GeneratorToolConfig[] = [
  {
    key: "taverne",
    label: "Taverne",
    sections: [
      { key: "taverne-nom", label: "Nom de l'établissement" },
      { key: "taverne-etablissement", label: "L'établissement" },
      { key: "taverne-chambre", label: "La Chambre" },
    ],
  },
];
