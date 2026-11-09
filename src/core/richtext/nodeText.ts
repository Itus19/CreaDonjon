import type { SegmentContentNode } from "../schemas/entities/segments";

/**
 * Le texte lisible d'un noeud de paragraphe : sa valeur pour un texte, son
 * libelle pour une mention, rien pour une image posee dans le texte
 * (V3.1-189) — une image n'a pas de mots. Un seul endroit pour cet
 * aplatissement, repete jusqu'ici dans cinq fichiers.
 */
export function nodeText(node: SegmentContentNode): string {
  if (node.t === "text") return node.v;
  if (node.t === "ref") return node.label;
  return "";
}
