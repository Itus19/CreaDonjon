/**
 * V3.1-75 — noyau pur du tirage de la Table aléatoire : la séquence des dés à
 * figer, le moment où la ligne s'allume, les lignes barrées de « Sans
 * répétition ». Le serveur seul tire (règle 8) ; ici, on ne fait que dire dans
 * quel ordre et quand l'écran le montre.
 */

import type { BlockReference } from "@/src/core/schemas/blocks/reference";
import type { TableEntryPrice } from "@/src/core/tables/types";

export interface SousTirage {
  key: string;
  die: string;
  roll: number;
  text: string;
}

/** Ce que `POST /api/blocks/{id}/draw` rend pour chaque tirage. */
export interface Tirage {
  text: string;
  refs: BlockReference[];
  price?: TableEntryPrice;
  tier?: string;
  die: string;
  roll: number;
  /** La ligne sortie dans `entries`. */
  index: number;
  /** Sous-tirages de la cascade, profondeur d'abord : l'ordre où leurs dés se figent. */
  subDraws: SousTirage[];
}

/** Nombre de faces d'une notation « d20 » ; 0 si la notation est invalide. */
export function facesDe(die: string): number {
  const m = /^d(\d+)$/.exec(die);
  return m ? Number(m[1]) : 0;
}

export interface DeAFiger {
  /** Le dé de la table (`null`) ou la clé de la sous-table. */
  cle: string | null;
  faces: number;
  valeur: number;
  /** « d20 », « d6 »… */
  etiquette: string;
}

/** Les dés dans l'ordre où ils se figent : le dé de la table, puis celui de chaque sous-table. */
export function sequenceDes(tirage: Tirage): DeAFiger[] {
  return [
    { cle: null, faces: facesDe(tirage.die), valeur: tirage.roll, etiquette: tirage.die },
    ...tirage.subDraws.map((s) => ({ cle: s.key, faces: facesDe(s.die), valeur: s.roll, etiquette: s.die })),
  ];
}

/** Les instants (ms après la réponse) où chaque dé se fige : un par un, un pas après l'autre. */
export function delaisFigeage(nombreDes: number, pasMs: number): number[] {
  return Array.from({ length: nombreDes }, (_, i) => (i + 1) * pasMs);
}

export interface EtatRevelation {
  /** Tous les dés sont figés. */
  termine: boolean;
  /** La ligne sortie s'allume — seulement APRÈS le dernier dé. */
  ligneAllumee: boolean;
  /** Le texte du résultat reste pâle tant que l'animation dure. */
  texteEstompe: boolean;
}

export function etatRevelation(nombreDes: number, figes: number): EtatRevelation {
  const termine = nombreDes > 0 && figes >= nombreDes;
  return { termine, ligneAllumee: termine, texteEstompe: !termine };
}

export type EtatLigne = "normale" | "allumee" | "barree";

/**
 * L'état de chaque ligne. « Sans répétition » : les lignes déjà sorties sont
 * barrées et pâlies. La ligne qui vient de sortir (`courante`) reste hors de ce
 * barré — elle s'allume à la fin du dernier dé, pas avant.
 */
export function etatsLignes(
  nombreLignes: number,
  sorties: readonly number[],
  unique: boolean,
  courante: number | null,
  termine: boolean,
): EtatLigne[] {
  const dejaSorties = new Set(sorties);
  return Array.from({ length: nombreLignes }, (_, i): EtatLigne => {
    if (courante === i) return termine ? "allumee" : "normale";
    return unique && dejaSorties.has(i) ? "barree" : "normale";
  });
}

/** Ce qu'il reste à tirer en « sans répétition ». */
export function resteASortir(nombreLignes: number, sorties: readonly number[]): number {
  return Math.max(0, nombreLignes - new Set(sorties).size);
}

/** La liste à envoyer dans `exclude` : les lignes sorties, seulement en « sans répétition ». */
export function exclusPourTirage(sorties: readonly number[], unique: boolean): number[] {
  return unique ? [...new Set(sorties)] : [];
}

/** Ajoute la ligne sortie à la liste, sans doublon. */
export function ajouterSortie(sorties: readonly number[], index: number): number[] {
  return sorties.includes(index) ? [...sorties] : [...sorties, index];
}
