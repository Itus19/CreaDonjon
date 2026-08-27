/**
 * Construction pure d'un arbre genealogique (V2-H3, specs/wiki-blocs.md §2)
 * a partir d'aretes `relations` deja filtrees par visibilite et deja
 * bornees au monde — ce module ne touche jamais Supabase (regle absolue 14).
 *
 * Un frere/sœur ou un partenaire ne coute jamais de profondeur (meme
 * generation que la personne visitee) ; seul un lien parent-enfant fait
 * avancer d'une generation, dans la limite de `depthUp`/`depthDown`.
 */

export const FAMILY_RELATION_TYPES = [
  "parent_of",
  "adopted_by",
  "step_parent_of",
  "married_to",
  "partner_of",
  "ex_partner_of",
  "sibling_of",
  "half_sibling_of",
] as const;
export type FamilyRelationType = (typeof FAMILY_RELATION_TYPES)[number];

export interface FamilyEdgeInput {
  id: string;
  sourceId: string;
  targetId: string;
  relationType: FamilyRelationType;
  /** Libelle deja resolu (RELATION_LABELS_FR), affiche au survol du trait. */
  label: string;
}

export interface FamilyEntityInput {
  id: string;
  name: string;
  slug: string;
  entityKind: string;
}

export interface FamilyTreeNode {
  id: string;
  name: string;
  slug: string;
  entityKind: string;
  generation: number;
  order: number;
}

export interface FamilyTreeEdge {
  id: string;
  kind: "parent-child" | "partner" | "sibling";
  fromId: string;
  toId: string;
  label: string;
}

export interface FamilyTree {
  nodes: FamilyTreeNode[];
  edges: FamilyTreeEdge[];
  minGeneration: number;
  maxGeneration: number;
}

interface ParentChildLink {
  id: string;
  parentId: string;
  childId: string;
  label: string;
}

interface PairLink {
  id: string;
  aId: string;
  bId: string;
  label: string;
}

function normalizeParentChild(edge: FamilyEdgeInput): ParentChildLink | null {
  switch (edge.relationType) {
    // source = parent, target = enfant.
    case "parent_of":
    case "step_parent_of":
      return { id: edge.id, parentId: edge.sourceId, childId: edge.targetId, label: edge.label };
    // adopted_by : la source est l'adopte(e), la cible l'adoptant — sens inverse de parent_of.
    case "adopted_by":
      return { id: edge.id, parentId: edge.targetId, childId: edge.sourceId, label: edge.label };
    default:
      return null;
  }
}

function isPartnerType(t: FamilyRelationType): boolean {
  return t === "married_to" || t === "partner_of" || t === "ex_partner_of";
}

function isSiblingType(t: FamilyRelationType): boolean {
  return t === "sibling_of" || t === "half_sibling_of";
}

function pushTo<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

export function buildFamilyTree(params: {
  rootId: string;
  depthUp: number;
  depthDown: number;
  edges: FamilyEdgeInput[];
  entities: FamilyEntityInput[];
}): FamilyTree {
  const { rootId, depthUp, depthDown, edges, entities } = params;
  const entityById = new Map(entities.map((e) => [e.id, e]));
  if (!entityById.has(rootId)) {
    return { nodes: [], edges: [], minGeneration: 0, maxGeneration: 0 };
  }

  const parentChildLinks: ParentChildLink[] = [];
  const partnerLinks: PairLink[] = [];
  const siblingLinks: PairLink[] = [];
  for (const edge of edges) {
    const pc = normalizeParentChild(edge);
    if (pc) {
      parentChildLinks.push(pc);
      continue;
    }
    if (isPartnerType(edge.relationType)) {
      partnerLinks.push({ id: edge.id, aId: edge.sourceId, bId: edge.targetId, label: edge.label });
      continue;
    }
    if (isSiblingType(edge.relationType)) {
      siblingLinks.push({ id: edge.id, aId: edge.sourceId, bId: edge.targetId, label: edge.label });
    }
  }

  const childrenOf = new Map<string, ParentChildLink[]>();
  const parentsOf = new Map<string, ParentChildLink[]>();
  for (const link of parentChildLinks) {
    pushTo(childrenOf, link.parentId, link);
    pushTo(parentsOf, link.childId, link);
  }
  const partnersOf = new Map<string, PairLink[]>();
  for (const link of partnerLinks) {
    pushTo(partnersOf, link.aId, link);
    pushTo(partnersOf, link.bId, link);
  }
  const siblingsOf = new Map<string, PairLink[]>();
  for (const link of siblingLinks) {
    pushTo(siblingsOf, link.aId, link);
    pushTo(siblingsOf, link.bId, link);
  }

  const generationOf = new Map<string, number>();
  generationOf.set(rootId, 0);
  const queue: string[] = [rootId];
  const visitOrder: string[] = [rootId];

  function discover(id: string, generation: number): void {
    if (!entityById.has(id) || generationOf.has(id)) return;
    generationOf.set(id, generation);
    queue.push(id);
    visitOrder.push(id);
  }

  while (queue.length > 0) {
    const id = queue.shift() as string;
    const generation = generationOf.get(id) as number;

    for (const link of partnersOf.get(id) ?? []) {
      discover(link.aId === id ? link.bId : link.aId, generation);
    }
    for (const link of siblingsOf.get(id) ?? []) {
      discover(link.aId === id ? link.bId : link.aId, generation);
    }
    if (generation > -depthUp) {
      for (const link of parentsOf.get(id) ?? []) {
        discover(link.parentId, generation - 1);
      }
    }
    if (generation < depthDown) {
      for (const link of childrenOf.get(id) ?? []) {
        discover(link.childId, generation + 1);
      }
    }
  }

  // Ordonnancement par generation : les partenaires restent adjacents ;
  // sinon l'ordre de decouverte (BFS) donne un resultat stable.
  const idsByGeneration = new Map<number, string[]>();
  for (const id of visitOrder) {
    pushTo(idsByGeneration, generationOf.get(id) as number, id);
  }
  const orderById = new Map<string, number>();
  for (const ids of idsByGeneration.values()) {
    const placed = new Set<string>();
    let cursor = 0;
    for (const id of ids) {
      if (placed.has(id)) continue;
      orderById.set(id, cursor++);
      placed.add(id);
      for (const link of partnersOf.get(id) ?? []) {
        const otherId = link.aId === id ? link.bId : link.aId;
        if (placed.has(otherId) || generationOf.get(otherId) !== generationOf.get(id)) continue;
        orderById.set(otherId, cursor++);
        placed.add(otherId);
      }
    }
  }

  const nodes: FamilyTreeNode[] = [...generationOf.keys()].map((id) => {
    const entity = entityById.get(id) as FamilyEntityInput;
    return {
      id,
      name: entity.name,
      slug: entity.slug,
      entityKind: entity.entityKind,
      generation: generationOf.get(id) as number,
      order: orderById.get(id) as number,
    };
  });

  function sharesParent(a: string, b: string): boolean {
    const parentsOfA = new Set((parentsOf.get(a) ?? []).map((l) => l.parentId));
    return (parentsOf.get(b) ?? []).some((l) => parentsOfA.has(l.parentId));
  }

  const treeEdges: FamilyTreeEdge[] = [];
  for (const link of parentChildLinks) {
    if (!generationOf.has(link.parentId) || !generationOf.has(link.childId)) continue;
    treeEdges.push({ id: link.id, kind: "parent-child", fromId: link.parentId, toId: link.childId, label: link.label });
  }
  for (const link of partnerLinks) {
    if (!generationOf.has(link.aId) || !generationOf.has(link.bId)) continue;
    treeEdges.push({ id: link.id, kind: "partner", fromId: link.aId, toId: link.bId, label: link.label });
  }
  for (const link of siblingLinks) {
    if (!generationOf.has(link.aId) || !generationOf.has(link.bId)) continue;
    // Deja visuellement relies par un connecteur parent-enfant commun —
    // un trait direct en plus ferait doublon.
    if (sharesParent(link.aId, link.bId)) continue;
    treeEdges.push({ id: link.id, kind: "sibling", fromId: link.aId, toId: link.bId, label: link.label });
  }

  const generations = [...generationOf.values()];
  return {
    nodes,
    edges: treeEdges,
    minGeneration: Math.min(...generations),
    maxGeneration: Math.max(...generations),
  };
}
