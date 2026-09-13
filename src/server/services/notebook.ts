import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import type { EntitySummary } from "@/src/server/repos/entities";
import { findEntityByCreatorAndKind, listEntitiesForWorld } from "@/src/server/repos/entities";
import { listBlocksForEntity, insertBlock, type BlockRow } from "@/src/server/repos/blocks";
import { createEntity, listPlayerVisibleEntityIds } from "@/src/server/services/entities";
import { isWorldAdmin } from "@/src/server/services/permissions";
import { zNoteTreeBlockData, zNoteTreeItem, type NoteTreeItem } from "@/src/core/schemas/blocks/noteTree";
import type { OtherEntityOption } from "@/components/entities/RelationsChips";

type TypedClient = SupabaseClient<Database>;

export interface NotebookData {
  entityId: string;
  worldId: string;
  blockId: string;
  version: number;
  items: NoteTreeItem[];
  /** Pour le popover "épingler une fiche existante" (réutilise `RefLinkPopover`, V2.1-1) et pour résoudre le nom affiché des lignes déjà épinglées côté client — jamais dupliqué dans `items` (règle absolue n°16 par analogie). */
  otherEntities: OtherEntityOption[];
  userId: string;
}

/**
 * Récupère (ou crée au premier passage) l'entité `notes` privée d'un
 * compte dans ce monde — n'importe lequel : MJ comme joueuse (retour
 * utilisateur V2-M7b, déjà vrai avant ce ticket, seulement pas encore
 * branché côté sidebar MJ). Une seule entité par (monde, compte), jamais
 * partagée (`permissions.ts` §`isOwnPrivateNotes`).
 */
async function getOrCreateNotebookEntity(supabase: TypedClient, params: { worldId: string; userId: string }): Promise<EntitySummary> {
  const existing = await findEntityByCreatorAndKind(supabase, { worldId: params.worldId, createdBy: params.userId, entityKind: "notes" });
  if (existing) return existing;
  return createEntity(supabase, { worldId: params.worldId, createdBy: params.userId, name: "Notes", entityKind: "notes", aliases: [] });
}

/**
 * Récupère (ou crée) le bloc `note_tree` de ce cahier. Reprise non
 * destructive de l'ancien textarea (V2-M7b) : si l'entité porte encore son
 * ancien bloc `text` non vide et qu'aucun `note_tree` n'existe, son contenu
 * devient la première page du nouvel arbre plutôt que d'être perdu.
 */
async function getOrCreateNoteTreeBlock(supabase: TypedClient, entityId: string, userId: string): Promise<BlockRow> {
  const blocks = await listBlocksForEntity(supabase, entityId);
  const existing = blocks.find((b) => b.block_type === "note_tree");
  if (existing) return existing;

  const oldText = blocks.find((b) => b.block_type === "text");
  const oldSegments = (oldText?.data as { segments?: unknown[] } | undefined)?.segments ?? [];
  const items: NoteTreeItem[] =
    oldSegments.length > 0
      ? [
          zNoteTreeItem.parse({
            id: crypto.randomUUID(),
            parentId: null,
            position: 1000,
            kind: "page",
            title: "Notes",
            content: oldSegments,
          }),
        ]
      : [];

  return insertBlock(supabase, {
    entityId,
    blockType: "note_tree",
    display: { label: "Cahier", layout: "prose" },
    data: zNoteTreeBlockData.parse({ __v: 1, items }),
    displayOrder: 1000,
    visibilityLevel: "user",
    visibilityScopeId: userId,
    createdBy: userId,
  });
}

/**
 * Fiches épinglables dans le cahier (recherche du "+", V2.1-2) — même
 * filtrage de visibilité qu'`entityWindow.ts` §`otherEntities` : le MJ voit
 * tout, une joueuse seulement ce qui lui est déjà visible. Dupliqué
 * volontairement plutôt que factorisé (une dizaine de lignes, contexte
 * différent : ici jamais d'entité à exclure par elle-même).
 */
async function listPinnableEntities(supabase: TypedClient, worldId: string, userId: string): Promise<OtherEntityOption[]> {
  const all = await listEntitiesForWorld(supabase, worldId);
  const admin = await isWorldAdmin(supabase, { worldId, userId });
  let visible = all.filter((e) => e.entity_kind !== "notes");
  if (!admin) {
    const visibleIds = await listPlayerVisibleEntityIds(supabase, worldId, visible.map((e) => e.id), userId);
    visible = visible.filter((e) => visibleIds.has(e.id));
  }
  return visible.map((e) => ({ id: e.id, name: e.name, slug: e.slug, entity_kind: e.entity_kind, aliases: e.aliases }));
}

export async function getOrCreateNotebook(supabase: TypedClient, params: { worldId: string; userId: string }): Promise<NotebookData> {
  const entity = await getOrCreateNotebookEntity(supabase, params);
  const [block, otherEntities] = await Promise.all([
    getOrCreateNoteTreeBlock(supabase, entity.id, params.userId),
    listPinnableEntities(supabase, params.worldId, params.userId),
  ]);
  const parsed = zNoteTreeBlockData.parse(block.data);
  return {
    entityId: entity.id,
    worldId: params.worldId,
    blockId: block.id,
    version: block.version,
    items: parsed.items,
    otherEntities,
    userId: params.userId,
  };
}
