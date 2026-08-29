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
  /** Rang de glisser-depose (V2-G9) — absent pour d'anciennes fiches jamais reordonnees, traite alors comme 0. */
  display_order?: number;
  /** Concurrence optimiste (V2-G9) — porte jusqu'au client pour la requete de reordonnancement, absent dans les tests qui ne testent pas ce chemin (defaut 1, comme la colonne en base). */
  version?: number;
}

export interface PartOfEdge {
  source_entity_id: string;
  target_entity_id: string;
}

/**
 * PJ/PNJ n'est jamais un `entity_kind` distinct (specs/arbitrage-modifications.md
 * §3.1, un PJ se reconnait par `campaign_characters.is_pc`) — ce
 * remappage n'existe que pour grouper le sommaire (V2-G7), avant
 * `buildEntityTree`, jamais ecrit en base : le selecteur de type d'une
 * fiche continue de proposer "Personnage" tel quel.
 */
export function withPlayerCharacterKinds<T extends EntityNodeInput>(
  entities: T[],
  playerCharacterIds: Set<string>
): T[] {
  return entities.map((entity) =>
    entity.entity_kind === "character"
      ? { ...entity, entity_kind: playerCharacterIds.has(entity.id) ? "pj" : "pnj" }
      : entity
  );
}

export interface EntityTreeNode {
  id: string;
  name: string;
  slug: string;
  /** Rang de glisser-depose (V2-G9) — porte jusqu'au client pour calculer le prochain rang sur depot. */
  displayOrder: number;
  /** Concurrence optimiste (V2-G9) — porte jusqu'au client pour la requete de reordonnancement. */
  version: number;
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
 *
 * `kindOrder` (V2-G9, glisser-depose des categories) : les cles presentes y
 * apparaissent dans cet ordre, les cles absentes ensuite par ordre
 * alphabetique (comportement d'origine, avant toute reorganisation) —
 * jamais persiste ici, l'appelant fournit l'ordre du monde.
 */
export function buildEntityTree(
  entities: EntityNodeInput[],
  partOfEdges: PartOfEdge[],
  kindOrder: string[] = []
): EntityTreeGroup[] {
  // Tri alphabetique avant tout regroupement (V2, retour utilisateur :
  // "faciliter la recherche") : les listes de racines et d'enfants en
  // heritent automatiquement, un seul tri couvre les deux niveaux.
  // Remplace l'ancien tri par `display_order` (V2-G9, glisser-depose par
  // fiche) — abandonne cote sommaire au profit d'un ordre fixe et
  // previsible ; `display_order` reste en base (rang de creation, encore
  // utilise ailleurs) mais ne pilote plus ce classement.
  const sortedEntities = entities.slice().sort((a, b) => a.name.localeCompare(b.name));

  const kindOf = new Map(sortedEntities.map((e) => [e.id, e.entity_kind]));

  const groups = new Map<string, EntityNodeInput[]>();
  for (const entity of sortedEntities) {
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
      items.map((e) => [
        e.id,
        { id: e.id, name: e.name, slug: e.slug, displayOrder: e.display_order ?? 0, version: e.version ?? 1, children: [] },
      ])
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

  const orderIndex = new Map(kindOrder.map((kind, index) => [kind, index]));
  return result.sort((a, b) => {
    const ai = orderIndex.get(a.kind);
    const bi = orderIndex.get(b.kind);
    if (ai !== undefined && bi !== undefined) return ai - bi;
    if (ai !== undefined) return -1;
    if (bi !== undefined) return 1;
    return a.kind.localeCompare(b.kind);
  });
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
