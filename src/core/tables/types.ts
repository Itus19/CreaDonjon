import type { BlockReference } from "../schemas/blocks/reference";
import type { CoinType } from "../rules/currency";

/**
 * Formes pures du moteur de tables aleatoires (specs/outils-mj.md §2, V1-E1).
 * `BlockReference` (schemas/blocks/reference.ts) est reutilise tel quel — la
 * meme primitive que l'inventaire/le personnage relie deja une entree de
 * table a une entite ou une regle, jamais une troisieme forme concurrente.
 */

export interface TableEntryRange {
  min: number;
  max: number;
}

/**
 * Prix d'une entree de table (retour utilisateur, V2-J9bis suite — un menu
 * de taverne encodait son prix DANS `text`, "Bière brune locale — 4 pc",
 * jamais reexploitable). Meme `CoinType` que le porte-monnaie de
 * l'inventaire (`src/core/rules/currency.ts`) — un prix de table et un prix
 * d'objet d'inventaire sont la meme notion, pas deux representations
 * paralleles.
 */
export interface TableEntryPrice {
  amount: number;
  coin: CoinType;
}

export interface TableEntry {
  range: TableEntryRange;
  /**
   * Poids affiche (specs/outils-mj.md §2.1) — documentaire seulement : la
   * selection reelle se fait par `range` (on lance le de du gabarit et on
   * cherche l'entree dont la plage contient le resultat), exactement comme
   * une vraie table de jeu de role papier. Un poids qui ne correspond pas a
   * l'etendue de la plage n'empeche pas le tirage de fonctionner ; c'est a
   * l'auteur de la table de les garder coherents.
   */
  weight: number;
  text: string;
  /** Absent pour une table sans notion de prix (la plupart) — jamais infere depuis `text`. */
  price?: TableEntryPrice;
  /**
   * Palier de l'entree sur un axe de variante ordonne (retour utilisateur —
   * "il faut une logique scenaristique de tirage" : une table d'objets
   * d'echoppe ou de menu de taverne porte TOUS les paliers dans une seule
   * table plutot qu'une table par palier). Valeur = la cle d'une option de
   * l'axe designe par le slot qui tire cette table (`GeneratorTableSlot.tier`,
   * src/core/generators/types.ts) — jamais une echelle inventee a part.
   * Absent : l'entree est toujours eligible, quel que soit le palier
   * demande (utile pour une table qui n'a pas encore ete graduee).
   */
  tier?: string;
  refs?: BlockReference[];
}

export interface RandomTableData {
  /**
   * Cle stable de la table (V1-D4 en tire le meme principe pour les cles de
   * regle) — ce que `{table:cle}` designe dans le texte d'une AUTRE entree
   * pour declencher un tirage en cascade (specs/outils-mj.md §2.1). Portee :
   * les tables de la meme entite (une bibliotheque partagee entre entites
   * reste a ouvrir avec son propre cas concret, comme le bloc `weapon` de
   * ruleset l'a ete pour V1-D4).
   */
  key: string;
  /** Notation de de, ex. "d20", "d100" — jamais un nombre nu (specs/outils-mj.md §2.1). */
  die: string;
  entries: TableEntry[];
  /** Un tirage multiple ne repete jamais la meme entree tant qu'il en reste d'inutilisees. */
  unique_draws: boolean;
  attribution?: string;
}
