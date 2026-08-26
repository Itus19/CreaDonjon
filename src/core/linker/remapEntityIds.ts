/**
 * Reecrit tout identifiant d'entite embarque dans une valeur JSON
 * arbitraire (`blocks.data`, `entity_mechanical_revisions.mechanical_data`)
 * apres import/duplication d'un monde — les entites y renaissent avec de
 * nouveaux ids, mais un inventaire ("dague empruntee a X") ou un segment de
 * texte (`{ t: "ref", kind: "entity", id }`) les referencent par valeur, a
 * l'interieur du JSON, jamais via une colonne SQL remappable.
 *
 * Parcours structurel plutot que specifique a un type de bloc : tout objet
 * de la forme `{ kind: "entity", id: <uuid connu> }` est reecrit, quelle que
 * soit sa position — c'est exactement la forme de `zBlockReference`
 * (src/core/schemas/blocks/reference.ts) et des `ref` de narrative_content
 * (SCHEMA.md §6), mais rester structurel evite de coupler ce fichier a
 * chaque schema de bloc present et futur.
 */
export function remapEntityIds(value: unknown, idMap: ReadonlyMap<string, string>): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => remapEntityIds(item, idMap));
  }
  if (value !== null && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (obj.kind === "entity" && typeof obj.id === "string" && idMap.has(obj.id)) {
      return { ...obj, id: idMap.get(obj.id)! };
    }
    const result: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(obj)) {
      result[key] = remapEntityIds(v, idMap);
    }
    return result;
  }
  return value;
}
