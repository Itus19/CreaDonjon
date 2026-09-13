import { z } from "zod";
import { zNarrativeContent } from "../entities/segments";

/**
 * Bloc `note_tree` (V2.1-2) : le cahier de notes entier (MJ ou joueuse)
 * tient dans UN SEUL bloc, sur l'entité `notes` déjà créée pour chaque
 * compte par monde (`src/server/services/notebook.ts`, `entity_kind:
 * "notes"`, `permissions.ts` §`isOwnPrivateNotes` déjà générique à ce type
 * d'entité). Pas de nouvelle table : la mutation entière repasse par le
 * PATCH générique `/api/blocks/[blockId]` (optimistic concurrency par
 * `version`, déjà en place), exactement comme l'ancien textarea de notes.
 *
 * Deux natures de ligne dans le même arbre (retour utilisateur, 13
 * septembre) :
 * - `page` porte son propre contenu (mêmes segments qu'un bloc `text`,
 *   `RichTextEditor` réutilisé tel quel) ;
 * - `pinned_entity`/`pinned_rule` sont de purs raccourcis vers une fiche ou
 *   une règle déjà existante — jamais de nom dupliqué ici (règle absolue
 *   n°16 par analogie : une seule source de vérité pour un nom de fiche),
 *   le nom affiché se résout côté client contre `otherEntities`/
 *   `useWorldRuleEntries`, avec un état "lien brisé" si la cible a disparu
 *   ou n'est plus visible.
 *
 * `parentId`/`position` portent l'arborescence — imbrication libre,
 * profondeur illimitée (contrairement au modèle OneNote de référence, un
 * seul niveau) ; `position` suit la même convention numérique que
 * `display_order` (espacement large, pas de réécriture de toute la
 * fratrie à chaque déplacement).
 */
const zNoteTreeBase = z.object({
  id: z.string().min(1),
  parentId: z.string().nullable(),
  position: z.number(),
});

export const zNoteTreeItem = z.discriminatedUnion("kind", [
  zNoteTreeBase.extend({
    kind: z.literal("page"),
    title: z.string(),
    content: zNarrativeContent,
  }),
  zNoteTreeBase.extend({
    kind: z.literal("pinned_entity"),
    targetId: z.string().min(1),
  }),
  zNoteTreeBase.extend({
    kind: z.literal("pinned_rule"),
    targetKey: z.string().min(1),
  }),
]);
export type NoteTreeItem = z.infer<typeof zNoteTreeItem>;
export type NoteTreePage = Extract<NoteTreeItem, { kind: "page" }>;

export const zNoteTreeBlockData = z.object({
  __v: z.literal(1),
  items: z.array(zNoteTreeItem),
});
export type NoteTreeBlockData = z.infer<typeof zNoteTreeBlockData>;
