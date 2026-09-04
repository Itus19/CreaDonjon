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

/** Configuration de promotion (V2-J2) : quelle section fournit le NOM de la fiche creee par "Créer la fiche", et le type d'entite a lui donner — les autres sections deviennent chacune un bloc `text` (src/server/services/promotion.ts). Absent = outil pas encore promouvable. `withCreature` (V2-J-PNJ) affiche un selecteur de creature du bestiaire (`RuleEntryAutocomplete`) qui ajoute un bloc `statblock` a la fiche creee — jamais de creature inventee ou choisie au hasard. */
export interface GeneratorToolPromoteConfig {
  nameSectionKey: string;
  entityKind: string;
  withCreature?: boolean;
}

export interface GeneratorToolConfig {
  key: string;
  label: string;
  sections: readonly GeneratorToolSectionConfig[];
  promote?: GeneratorToolPromoteConfig;
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
    promote: { nameSectionKey: "taverne-nom", entityKind: "location" },
  },
  {
    key: "pnj",
    label: "PNJ",
    sections: [
      { key: "pnj-nom", label: "Nom" },
      { key: "pnj-apparence", label: "Apparence" },
      { key: "pnj-histoire", label: "Histoire" },
    ],
    promote: { nameSectionKey: "pnj-nom", entityKind: "character", withCreature: true },
  },
];
