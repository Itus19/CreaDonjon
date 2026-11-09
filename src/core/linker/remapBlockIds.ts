/**
 * Reecrit tout identifiant de BLOC embarque dans une valeur JSON (`blocks.data`)
 * quand des blocs renaissent avec de nouveaux ids : duplication d'une fiche,
 * duplication ou import d'un monde. Jumeau de `remapEntityIds`, pour les blocs.
 *
 * Deux formes existent aujourd'hui, toutes deux sous une cle `blockId` :
 * l'image posee dans le texte (`{ t: "image", blockId }`, V3.1-189) et
 * l'ancien ancrage d'une image sur un bloc texte (`anchor.blockId`, V2.1-11),
 * que les duplications ne recalaient pas. Structurel, comme `remapEntityIds` :
 * seule la cle `blockId` dont la valeur figure dans la table est reecrite.
 */
export function remapBlockIds(value: unknown, idMap: ReadonlyMap<string, string>): unknown {
  if (Array.isArray(value)) return value.map((item) => remapBlockIds(item, idMap));
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      result[key] = key === "blockId" && typeof v === "string" && idMap.has(v) ? idMap.get(v)! : remapBlockIds(v, idMap);
    }
    return result;
  }
  return value;
}
