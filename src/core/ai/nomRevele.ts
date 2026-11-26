import { textNamesSketch } from "../rules/scene";

/**
 * V3.2-45 — Quand une narration dit le vrai nom d'un PNJ que le personnage ne
 * connaissait que par un libellé (« aubergiste, d'âge mûr »), le nom est
 * appris : la fiche quitte son « nom pour la table » (ADR 0105).
 *
 * Le vrai nom n'arrive au modèle que comme secret du MJ (ADR 0117), avec la
 * consigne de ne l'écrire que si le PNJ se présente ou qu'on le dit au
 * personnage ; le moteur, lui, constate seulement qu'il est écrit.
 *
 * Compte comme dit : le nom entier, sa tête avant la virgule (« Mabelle, du
 * Fanal »), ou son premier mot s'il a au moins trois lettres (« Mabelle
 * Roux » dit « Mabelle »). Mot entier, sans tenir compte des majuscules.
 *
 * Module PUR.
 */
export function nomsDitsDans(texte: string, vraisNoms: readonly { entityId: string; trueName: string }[]): string[] {
  return vraisNoms
    .filter(({ trueName }) => {
      const tete = trueName.split(",")[0]!.trim();
      const prenom = tete.split(/\s+/)[0] ?? "";
      return textNamesSketch(texte, trueName) || (prenom.length >= 3 && textNamesSketch(texte, prenom));
    })
    .map((n) => n.entityId);
}
