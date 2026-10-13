import type { NarrativeContent } from "../schemas/entities/segments";
import type { NoteTreeItem } from "../schemas/blocks/noteTree";

/**
 * Partager une page du cahier avec la table (V3.1-41, ADR 0037). La page
 * devient sa propre entité, de genre `shared_note`, que le cahier désigne
 * par un lien. Fonctions pures : le service fait les écritures.
 */
export const SHARED_NOTE_KIND = "shared_note";

/**
 * Le nom de TOUTE entité `shared_note`, partagée ou non. La RLS d'`entities`
 * laisse tout membre du monde lire le nom d'une entité : y mettre le titre
 * de la page le laisserait lisible une fois la page repassée en privée. Le
 * vrai titre vit dans le libellé de son bloc de texte, protégé par la
 * visibilité du bloc.
 */
export const SHARED_NOTE_ENTITY_NAME = "Page du cahier";

/** La page `pageId` laisse place à un lien `shared_page` vers `entityId`, à la même place ; `null` si `pageId` n'est pas une page. */
export function pageToSharedLink(items: readonly NoteTreeItem[], pageId: string, entityId: string): NoteTreeItem[] | null {
  const target = items.find((i) => i.id === pageId);
  if (!target || target.kind !== "page") return null;
  return items.map((i) =>
    i.id === pageId ? { id: i.id, parentId: i.parentId, position: i.position, kind: "shared_page" as const, targetId: entityId } : i
  );
}

/**
 * Un lien vers une fiche que le lecteur ne connaît pas devient du texte
 * simple, SANS identifiant (règle absolue 5 : rien d'inutile n'est envoyé).
 * Le nom reste lisible, puisque l'autrice l'a écrit ; la fiche, elle, ne se
 * révèle pas. Les liens de règle et d'image ne sont pas concernés.
 */
export function unlinkUnknownEntityRefs(content: NarrativeContent, knownEntityIds: ReadonlySet<string>): NarrativeContent {
  return content.map((segment) => ({
    ...segment,
    content: segment.content.map((node) =>
      node.t === "ref" && node.kind === "entity" && (!node.id || !knownEntityIds.has(node.id)) ? { t: "text" as const, v: node.label } : node
    ),
  }));
}
