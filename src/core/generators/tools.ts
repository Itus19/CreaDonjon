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

import type { GeneratorVariantAxis } from "./variants";

export interface GeneratorToolSectionConfig {
  key: string;
  label: string;
}

/**
 * Configuration de promotion (V2-J2) : quelle section fournit le NOM de la
 * fiche creee par "Créer la fiche", et le type d'entite a lui donner — les
 * autres sections deviennent chacune un bloc `text` (src/server/services/
 * promotion.ts), sauf celles nommees explicitement ci-dessous qui
 * deviennent un bloc structure. Absent = outil pas encore promouvable.
 *
 * `withCreature` (V2-J-PNJ) affiche un selecteur de creature du bestiaire
 * (`RuleEntryAutocomplete`) qui ajoute un bloc `statblock` — jamais de
 * creature inventee ou choisie au hasard.
 *
 * `personalitySectionKey`/`questSectionKey` : la section produit un bloc
 * `personality`/`quest` a partir de ses emplacements de table individuels
 * (jamais du texte assemble) — voir la construction cote route de
 * promotion. `withWorldview` ajoute un bloc `worldview` genere sans section
 * dediee : ce bloc n'est que des poles numeriques (specs/psyche-pnj.md §2),
 * rien a prevoir/relancer a l'ecran pour l'auteur du PNJ.
 */
export interface GeneratorToolPromoteConfig {
  nameSectionKey: string;
  entityKind: string;
  withCreature?: boolean;
  personalitySectionKey?: string;
  withWorldview?: boolean;
  questSectionKey?: string;
}

export interface GeneratorToolConfig {
  key: string;
  label: string;
  sections: readonly GeneratorToolSectionConfig[];
  /**
   * Axes de variante (V2-J7) — un `<select>` par axe, au-dessus des
   * sections, partage par TOUTES les sections de l'outil (pas de
   * granularite par section : "choisir le type... avant de generer LES
   * elements", retour utilisateur). La cle d'un axe sert d'emplacement
   * `{cle}` interpolable a la fois dans la CLE de table d'un emplacement
   * (`"objets-{type}"`, resolue avant le tirage) et dans le gabarit final
   * (resolue vers le LIBELLE de l'option choisie, cote route) — meme
   * mecanisme `renderGeneratorTemplate` dans les deux cas.
   */
  variants?: readonly GeneratorVariantAxis[];
  promote?: GeneratorToolPromoteConfig;
}

export const GENERATOR_TOOLS: readonly GeneratorToolConfig[] = [
  {
    key: "taverne",
    label: "Taverne",
    sections: [
      { key: "taverne-nom", label: "Nom de l'établissement" },
      { key: "taverne-etablissement", label: "L'établissement" },
      { key: "taverne-apparence", label: "Apparence" },
      { key: "taverne-histoire", label: "Histoire" },
      { key: "taverne-chambre", label: "La Chambre" },
      { key: "taverne-menu", label: "Menu" },
    ],
    // Memes cles/libelles d'options que l'axe wealth/zone d'Échoppe (V2-J7)
    // — vocabulaire coherent entre les deux outils — mais declares separement :
    // deux outils seulement, pas encore de troisieme cas concret pour justifier
    // un registre d'axes partages (CLAUDE.md, "regle des trois").
    variants: [
      {
        key: "wealth",
        label: "Richesse",
        allowRandom: true,
        options: [
          { key: "modeste", label: "Modeste" },
          { key: "correcte", label: "Correcte" },
          { key: "reputee", label: "Réputée" },
        ],
      },
      {
        key: "zone",
        label: "Zone",
        options: [
          { key: "bourg", label: "Bourg" },
          { key: "ville", label: "Ville" },
          { key: "capitale", label: "Capitale" },
        ],
      },
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
      { key: "pnj-personnalite", label: "Personnalité" },
      { key: "pnj-quete", label: "Quête" },
    ],
    promote: {
      nameSectionKey: "pnj-nom",
      entityKind: "character",
      withCreature: true,
      personalitySectionKey: "pnj-personnalite",
      withWorldview: true,
      questSectionKey: "pnj-quete",
    },
  },
  {
    key: "noms",
    label: "Noms",
    // Pas de `promote` : un nom seul n'a pas vocation a devenir une fiche
    // (contrairement a Taverne/PNJ/Échoppe) — juste une inspiration a copier.
    // Une section par culture plutot qu'un selecteur "Aléatoire" : choisir
    // une section AU HASARD parmi celles-ci produit exactement le meme
    // resultat, sans construire un second mecanisme de tirage.
    sections: [
      { key: "noms-humain", label: "Humain" },
      { key: "noms-elfe", label: "Elfe" },
      { key: "noms-nain", label: "Nain" },
      { key: "noms-halfelin", label: "Halfelin" },
    ],
  },
  {
    key: "echoppe",
    label: "Échoppe",
    sections: [
      { key: "echoppe-nom", label: "Nom de la boutique" },
      { key: "echoppe-boutique", label: "La boutique" },
      { key: "echoppe-apparence", label: "Apparence" },
      { key: "echoppe-histoire", label: "Histoire" },
      { key: "echoppe-objet", label: "Un objet en vente" },
    ],
    variants: [
      {
        key: "type",
        label: "Type",
        allowRandom: true,
        options: [
          { key: "apothicaire", label: "Apothicaire" },
          { key: "forgeron", label: "Forgeron" },
          { key: "armurier", label: "Armurier" },
          { key: "herboriste", label: "Herboriste" },
          { key: "bazar", label: "Bazar" },
          { key: "tailleur", label: "Tailleur" },
          { key: "librairie", label: "Librairie" },
          { key: "joaillier", label: "Joaillier" },
          { key: "maison-close", label: "Maison close" },
        ],
      },
      {
        key: "wealth",
        label: "Richesse",
        allowRandom: true,
        options: [
          { key: "modeste", label: "Modeste" },
          { key: "correcte", label: "Correcte" },
          { key: "reputee", label: "Réputée" },
        ],
      },
      {
        key: "zone",
        label: "Zone",
        options: [
          { key: "bourg", label: "Bourg" },
          { key: "ville", label: "Ville" },
          { key: "capitale", label: "Capitale" },
        ],
      },
    ],
    promote: { nameSectionKey: "echoppe-nom", entityKind: "location" },
  },
  {
    key: "butin",
    label: "Butin",
    // Pas de `promote` : un butin n'est pas une entite (contrairement a
    // Taverne/Échoppe/PNJ) — une liste d'objets a copier dans les notes de
    // seance, meme discipline que "Noms" (aucune fiche a en tirer).
    sections: [{ key: "butin-objets", label: "Objets magiques" }],
    variants: [
      {
        key: "rarity",
        label: "Rareté",
        allowRandom: true,
        // Vocabulaire de rarete officiel D&D (Magic-Items[].rarity.name du
        // SRD deja importe), pas une echelle inventee a part — meme axe que
        // `TableEntry.tier` des entrees de la table de butin (V2-J9quater).
        options: [
          { key: "commun", label: "Commun" },
          { key: "peu-commun", label: "Peu commun" },
          { key: "rare", label: "Rare" },
          { key: "tres-rare", label: "Très rare" },
          { key: "legendaire", label: "Légendaire" },
        ],
      },
    ],
  },
];

/**
 * Retrouve l'outil auquel appartient une section, par sa cle (V2-J7) — un
 * bloc `generator` ne connait que sa propre `GeneratorData.key`
 * (ex. "echoppe-objet"), jamais son `toolKey` : c'est ce lookup qui fait le
 * lien pour resoudre les axes de variante de l'outil au moment du tirage.
 */
export function toolForSectionKey(sectionKey: string): GeneratorToolConfig | undefined {
  return GENERATOR_TOOLS.find((tool) => tool.sections.some((s) => s.key === sectionKey));
}
