/**
 * V3.2-19 — Les lieux où la narration peut proposer d'emmener le personnage
 * (`move_to`) : ceux que la relation `part_of` relie au lieu courant. Les
 * lieux qu'il contient (la cuisine de l'auberge), celui qui le contient (le
 * bourg), et ceux du même parent (la forge d'à côté). Jamais un lieu
 * lointain : un voyage n'est pas un déplacement de scène.
 *
 * Fonction pure : l'appelant passe les arêtes du monde et filtre ensuite
 * ce que le joueur peut voir (règle absolue 5).
 */
export interface PartOfEdgeLike {
  source_entity_id: string;
  target_entity_id: string;
}

export function lieuxVoisins(locationId: string, edges: readonly PartOfEdgeLike[]): string[] {
  const out = new Set<string>();
  const parents = new Set<string>();
  for (const edge of edges) {
    if (edge.target_entity_id === locationId) out.add(edge.source_entity_id);
    if (edge.source_entity_id === locationId) {
      out.add(edge.target_entity_id);
      parents.add(edge.target_entity_id);
    }
  }
  for (const edge of edges) {
    if (parents.has(edge.target_entity_id)) out.add(edge.source_entity_id);
  }
  out.delete(locationId);
  return [...out];
}
