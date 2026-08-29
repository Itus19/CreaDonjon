/**
 * Construction pure du graphe de relations (V2-H1 phase 5, bloc
 * `relations_graph`) a partir d'aretes `relations` deja filtrees par
 * visibilite et deja bornees au monde — ce module ne touche jamais
 * Supabase (regle absolue 14). A la difference de `buildFamilyTree`
 * (V2-H3), tout type de relation compte, dans les deux sens (une relation
 * stockee une fois se traverse comme un lien non oriente pour la
 * decouverte des voisins — seul l'affichage du libelle reste dirige).
 */

export interface GraphEdgeInput {
  id: string;
  sourceId: string;
  targetId: string;
  relationType: string;
  /** Libelle deja resolu (RELATION_LABELS_FR), affiche au survol du lien. */
  label: string;
  visibilityLevel: string;
}

export interface GraphEntityInput {
  id: string;
  name: string;
  slug: string;
  entityKind: string;
}

export interface RelationsGraphNode {
  id: string;
  name: string;
  slug: string;
  entityKind: string;
  /** Distance en sauts depuis la racine — 0 pour la racine elle-meme. */
  degree: number;
}

export interface RelationsGraphEdge {
  id: string;
  fromId: string;
  toId: string;
  relationType: string;
  label: string;
  visibilityLevel: string;
}

export interface RelationsGraph {
  nodes: RelationsGraphNode[];
  edges: RelationsGraphEdge[];
}

function pushTo<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

export function buildRelationsGraph(params: {
  rootId: string;
  maxDegree: number;
  edges: GraphEdgeInput[];
  entities: GraphEntityInput[];
}): RelationsGraph {
  const { rootId, maxDegree, edges, entities } = params;
  const entityById = new Map(entities.map((e) => [e.id, e]));
  if (!entityById.has(rootId)) return { nodes: [], edges: [] };

  const neighborsOf = new Map<string, GraphEdgeInput[]>();
  for (const edge of edges) {
    if (!entityById.has(edge.sourceId) || !entityById.has(edge.targetId)) continue;
    pushTo(neighborsOf, edge.sourceId, edge);
    pushTo(neighborsOf, edge.targetId, edge);
  }

  const degreeOf = new Map<string, number>();
  degreeOf.set(rootId, 0);
  const queue: string[] = [rootId];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    const degree = degreeOf.get(id) as number;
    if (degree >= maxDegree) continue;
    for (const edge of neighborsOf.get(id) ?? []) {
      const otherId = edge.sourceId === id ? edge.targetId : edge.sourceId;
      if (degreeOf.has(otherId)) continue;
      degreeOf.set(otherId, degree + 1);
      queue.push(otherId);
    }
  }

  const nodes: RelationsGraphNode[] = [...degreeOf.keys()].map((id) => {
    const entity = entityById.get(id) as GraphEntityInput;
    return { id, name: entity.name, slug: entity.slug, entityKind: entity.entityKind, degree: degreeOf.get(id) as number };
  });

  const graphEdges: RelationsGraphEdge[] = [];
  const seenEdgeIds = new Set<string>();
  for (const edge of edges) {
    if (seenEdgeIds.has(edge.id)) continue;
    if (!degreeOf.has(edge.sourceId) || !degreeOf.has(edge.targetId)) continue;
    // Retour utilisateur : au degre N, on voit les nœuds JUSQU'AU degre N,
    // mais une arete entre deux nœuds tous deux AU degre maximal (aucun des
    // deux n'est "plus proche" que la limite) reste cachee — sinon
    // n'importe quel lien entre deux voisins directs de la racine
    // apparaitrait deja au degre 1, avant meme d'avoir choisi de "monter
    // d'un cran". Un lien qui touche la racine (degre 0) passe toujours ce
    // test des que maxDegree >= 1.
    if (Math.min(degreeOf.get(edge.sourceId) as number, degreeOf.get(edge.targetId) as number) >= maxDegree) continue;
    seenEdgeIds.add(edge.id);
    graphEdges.push({
      id: edge.id,
      fromId: edge.sourceId,
      toId: edge.targetId,
      relationType: edge.relationType,
      label: edge.label,
      visibilityLevel: edge.visibilityLevel,
    });
  }

  return { nodes, edges: graphEdges };
}
