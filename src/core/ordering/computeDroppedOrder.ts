/**
 * Deplace un element d'un index a un autre — reimplemente ici (au lieu
 * d'importer `arrayMove` de `@dnd-kit/sortable`) parce que `src/core` est un
 * noyau pur (CLAUDE.md, regle absolue 14) : aucune dependance de framework,
 * meme une aussi petite que celle-ci.
 */
function arrayMove<T>(array: T[], oldIndex: number, newIndex: number): T[] {
  const next = array.slice();
  const [moved] = next.splice(oldIndex, 1);
  next.splice(newIndex, 0, moved);
  return next;
}

/**
 * Nouvel emplacement d'un element depose (V2-G1, glisser-deposer de blocs ;
 * repris tel quel pour les fiches/categories de la sidebar, V2-G9) : meme
 * logique d'ecart que des boutons Monter/Descendre, generalisee a une
 * position d'arrivee arbitraire — `displayOrder` reste un `numeric`, jamais
 * une renumerotation de toute la liste (docs/SCHEMA.md). `null` si le depot
 * n'a rien deplace (cible introuvable ou identique a la source).
 */
export function computeDroppedOrder<T extends { id: string; displayOrder: number }>(
  sortedItems: T[],
  activeId: string,
  overId: string
): number | null {
  const oldIndex = sortedItems.findIndex((item) => item.id === activeId);
  const newIndex = sortedItems.findIndex((item) => item.id === overId);
  if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return null;
  const reordered = arrayMove(sortedItems, oldIndex, newIndex);
  const finalIndex = reordered.findIndex((item) => item.id === activeId);
  const before = reordered[finalIndex - 1];
  const after = reordered[finalIndex + 1];
  if (before && after) return (before.displayOrder + after.displayOrder) / 2;
  if (before) return before.displayOrder + 1000;
  if (after) return after.displayOrder - 1000;
  return 1000;
}
