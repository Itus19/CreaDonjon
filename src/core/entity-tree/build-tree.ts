/**
 * Arborescence de la barre laterale : groupee par entity_kind, imbriquee
 * par part_of (specs/coquille-et-design.md §4.3). Derivee, jamais saisie —
 * aucun dossier manuel qui pourrait diverger de la hierarchie reelle.
 */

export interface EntityNodeInput {
  id: string;
  name: string;
  slug: string;
  entity_kind: string;
}

export interface PartOfEdge {
  source_entity_id: string;
  target_entity_id: string;
}

export interface EntityTreeNode {
  id: string;
  name: string;
  slug: string;
  children: EntityTreeNode[];
}

export interface EntityTreeGroup {
  kind: string;
  items: EntityTreeNode[];
}

/**
 * part_of : la source est l'enfant (contenu dans la cible). Seules les
 * aretes internes a un meme groupe de entity_kind imbriquent — une arete
 * qui traverserait les groupes (rare, part_of etant essentiellement
 * spatial) laisse l'entite racine dans son propre groupe plutot que de
 * deviner ou l'accrocher.
 */
export function buildEntityTree(
  entities: EntityNodeInput[],
  partOfEdges: PartOfEdge[]
): EntityTreeGroup[] {
  const kindOf = new Map(entities.map((e) => [e.id, e.entity_kind]));

  const groups = new Map<string, EntityNodeInput[]>();
  for (const entity of entities) {
    const list = groups.get(entity.entity_kind) ?? [];
    list.push(entity);
    groups.set(entity.entity_kind, list);
  }

  const parentOf = new Map<string, string>();
  for (const edge of partOfEdges) {
    if (kindOf.get(edge.source_entity_id) === kindOf.get(edge.target_entity_id)) {
      parentOf.set(edge.source_entity_id, edge.target_entity_id);
    }
  }

  const result: EntityTreeGroup[] = [];
  for (const [kind, items] of groups) {
    const nodeById = new Map<string, EntityTreeNode>(
      items.map((e) => [e.id, { id: e.id, name: e.name, slug: e.slug, children: [] }])
    );
    const roots: EntityTreeNode[] = [];

    for (const item of items) {
      const node = nodeById.get(item.id);
      if (!node) continue;
      const parentId = parentOf.get(item.id);
      const parentNode = parentId ? nodeById.get(parentId) : undefined;
      if (parentNode) {
        parentNode.children.push(node);
      } else {
        roots.push(node);
      }
    }

    result.push({ kind, items: roots });
  }

  return result.sort((a, b) => a.kind.localeCompare(b.kind));
}

/**
 * Recherche locale dans le sommaire (peau « livre », V2-G2) : sous-chaine
 * insensible a la casse sur le nom. Un noeud correspondant garde tous ses
 * enfants (contexte de navigation preserve) ; un noeud non-correspondant
 * survit seulement si un de ses descendants correspond. Purement client —
 * l'arborescence est deja chargee en entier, pas besoin d'aller-retour
 * serveur pour filtrer une poignee d'entites.
 */
export function filterEntityTree(groups: EntityTreeGroup[], query: string): EntityTreeGroup[] {
  const q = query.trim().toLowerCase();
  if (q === "") return groups;

  function filterNode(node: EntityTreeNode): EntityTreeNode | null {
    if (node.name.toLowerCase().includes(q)) return node;
    const children = node.children.map(filterNode).filter((n): n is EntityTreeNode => n !== null);
    if (children.length === 0) return null;
    return { ...node, children };
  }

  return groups
    .map((group) => ({ ...group, items: group.items.map(filterNode).filter((n): n is EntityTreeNode => n !== null) }))
    .filter((group) => group.items.length > 0);
}
