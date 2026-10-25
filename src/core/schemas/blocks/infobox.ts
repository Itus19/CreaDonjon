import { z } from "zod";
import { zSegmentContentNode, type SegmentContentNode } from "../entities/segments";

/**
 * Valeur d'une ligne d'Encadré. V3.1-66 : « @ » y cite une fiche, comme dans
 * le texte. Une valeur est donc soit une chaîne (la forme d'avant, toujours
 * valide : rien à migrer), soit une suite de nœuds texte et mention — les
 * mêmes nœuds que les segments du bloc Texte (`zSegmentContentNode`). Le
 * libellé d'une mention est du texte écrit par l'auteur ; le lien, lui, n'est
 * résolu côté serveur que si le lecteur voit la fiche citée (règle 5).
 */
export const zInfoboxValue = z.union([z.string(), z.array(zSegmentContentNode)]);
export type InfoboxValue = z.infer<typeof zInfoboxValue>;

/** Bloc `infobox` (layout: key_values, specs/wiki-blocs.md §1) : l'encadre classique. */
export const zInfoboxEntry = z.object({
  label: z.string().min(1),
  value: zInfoboxValue,
});
export type InfoboxEntry = z.infer<typeof zInfoboxEntry>;

export const zInfoboxBlockData = z.object({
  __v: z.literal(1),
  entries: z.array(zInfoboxEntry),
});
export type InfoboxBlockData = z.infer<typeof zInfoboxBlockData>;

/** La valeur en nœuds : une chaîne devient un seul nœud texte (aucun si elle est vide). */
export function infoboxValueNodes(value: InfoboxValue): SegmentContentNode[] {
  if (typeof value !== "string") return value;
  return value === "" ? [] : [{ t: "text", v: value }];
}

/** Le texte brut d'une valeur : les mentions se lisent par leur libellé (générateurs, recherche, âge du solo). */
export function infoboxValueText(value: InfoboxValue): string {
  return infoboxValueNodes(value)
    .map((node) => (node.t === "text" ? node.v : node.label))
    .join("");
}

/** Les fiches citées par l'Encadré, sans doublon, dans l'ordre d'apparition. */
export function infoboxEntityRefIds(data: InfoboxBlockData): string[] {
  const ids = new Set<string>();
  for (const entry of data.entries) {
    for (const node of infoboxValueNodes(entry.value)) {
      if (node.t === "ref" && node.kind === "entity" && node.id) ids.add(node.id);
    }
  }
  return [...ids];
}
