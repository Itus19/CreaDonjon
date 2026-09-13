import type { NoteTreeItem } from "../schemas/blocks/noteTree";

/** Position par defaut du premier enfant d'une fratrie vide (meme convention que `display_order`). */
const FIRST_POSITION = 1000;
const POSITION_STEP = 1000;

function children(items: readonly NoteTreeItem[], parentId: string | null): NoteTreeItem[] {
  return items.filter((i) => i.parentId === parentId).sort((a, b) => a.position - b.position);
}

/** Position a donner a un nouvel element ajoute en dernier dans sa fratrie. */
export function nextSiblingPosition(items: readonly NoteTreeItem[], parentId: string | null): number {
  const siblings = children(items, parentId);
  if (siblings.length === 0) return FIRST_POSITION;
  return Math.max(...siblings.map((i) => i.position)) + POSITION_STEP;
}

/**
 * Vrai si deplacer `movedId` sous `newParentId` creerait un cycle (le
 * deplacer dans lui-meme ou dans l'un de ses propres descendants) — sans ce
 * garde, glisser un dossier dans l'une de ses sous-pages detacherait toute
 * la branche du reste de l'arbre (plus aucun chemin vers la racine).
 */
export function wouldCreateCycle(items: readonly NoteTreeItem[], movedId: string, newParentId: string | null): boolean {
  if (newParentId === null) return false;
  if (newParentId === movedId) return true;
  let current: string | null = newParentId;
  const byId = new Map(items.map((i) => [i.id, i]));
  while (current !== null) {
    if (current === movedId) return true;
    current = byId.get(current)?.parentId ?? null;
  }
  return false;
}

/**
 * Deplace un element vers un nouveau parent, a l'index donne parmi les
 * FUTURS freres (avant le deplacement lui-meme). Recalcule sa `position`
 * comme le milieu de ses deux nouveaux voisins (meme convention que
 * `display_order` : une seule ligne modifiee, jamais toute la fratrie
 * reecrite). Retourne le meme tableau (identite inchangee) si le
 * deplacement creerait un cycle — a l'appelant de l'ignorer silencieusement.
 */
export function moveItem(
  items: readonly NoteTreeItem[],
  movedId: string,
  newParentId: string | null,
  index: number
): NoteTreeItem[] {
  if (wouldCreateCycle(items, movedId, newParentId)) return items as NoteTreeItem[];
  const siblings = children(items, newParentId).filter((i) => i.id !== movedId);
  const before = siblings[index - 1];
  const after = siblings[index];
  const position =
    before && after ? (before.position + after.position) / 2 : after ? after.position - POSITION_STEP : before ? before.position + POSITION_STEP : FIRST_POSITION;

  return items.map((i) => (i.id === movedId ? { ...i, parentId: newParentId, position } : i));
}

/** Retire un element et toute sa descendance (peu importe la profondeur). */
export function removeItemAndDescendants(items: readonly NoteTreeItem[], id: string): NoteTreeItem[] {
  const toRemove = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const item of items) {
      if (item.parentId !== null && toRemove.has(item.parentId) && !toRemove.has(item.id)) {
        toRemove.add(item.id);
        grew = true;
      }
    }
  }
  return items.filter((i) => !toRemove.has(i.id));
}

/** Renomme une page (jamais une fiche epinglee : son nom vient toujours de sa cible reelle). */
export function renamePage(items: readonly NoteTreeItem[], id: string, title: string): NoteTreeItem[] {
  const target = items.find((i) => i.id === id);
  if (!target || target.kind !== "page") return items as NoteTreeItem[];
  return items.map((i) => (i.id === id ? { ...i, title } : i));
}
