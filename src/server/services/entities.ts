import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { nextNumericSlug } from "@/src/core/slug/slug";
import { buildEntityTree, withPlayerCharacterKinds, type EntityTreeGroup } from "@/src/core/entity-tree/build-tree";
import {
  type EntitySearchResult,
  type EntitySummary,
  getEntityById,
  insertEntity,
  listEntitiesForWorld,
  listEntitySlugsForWorld,
  maxEntityDisplayOrderForKind,
  searchEntitiesInWorld,
  softDeleteEntity,
  updateEntityDisplayOrder,
  updateEntityWithVersionCheck,
  worldHasSlug,
} from "@/src/server/repos/entities";
import { getWorldEntityKindOrder } from "@/src/server/repos/worlds";
import { listPartOfRelationsForWorld } from "@/src/server/repos/relations";
import { insertBlock, listBlocksForEntity } from "@/src/server/repos/blocks";
import { recordEntityRevision } from "@/src/server/services/entityHistory";
import { listPlayerCharacterEntityIds } from "@/src/server/services/worldPlayerCharacters";

type TypedClient = SupabaseClient<Database>;

export async function listEntities(supabase: TypedClient, worldId: string): Promise<EntitySummary[]> {
  return listEntitiesForWorld(supabase, worldId);
}

/** Barre laterale (specs/coquille-et-design.md §4.3) : arborescence derivee, jamais saisie. */
export async function getEntityTree(
  supabase: TypedClient,
  worldId: string
): Promise<EntityTreeGroup[]> {
  const [entities, partOfEdges, playerCharacterIds, kindOrder] = await Promise.all([
    listEntitiesForWorld(supabase, worldId),
    listPartOfRelationsForWorld(supabase, worldId),
    listPlayerCharacterEntityIds(supabase, worldId),
    getWorldEntityKindOrder(supabase, worldId),
  ]);
  return buildEntityTree(withPlayerCharacterKinds(entities, playerCharacterIds), partOfEdges, kindOrder);
}

/**
 * Slug numerique (V0-06g) : le titre d'une fiche est editable en place a
 * tout moment, un slug derive du nom au moment de la creation devient
 * trompeur des le premier renommage. Un numero ne represente jamais que
 * lui-meme. La collision (deux creations concurrentes calculant le meme
 * numero) reste possible en theorie — meme profil de risque que
 * l'ancienne verification "worldHasSlug puis retente" qu'elle remplace,
 * pas un nouveau risque introduit ici.
 */
async function generateUniqueEntitySlug(supabase: TypedClient, worldId: string): Promise<string> {
  const existingSlugs = await listEntitySlugsForWorld(supabase, worldId);
  let candidate = nextNumericSlug(existingSlugs);
  while (await worldHasSlug(supabase, worldId, candidate)) {
    candidate = String(Number(candidate) + 1);
  }
  return candidate;
}

export async function createEntity(
  supabase: TypedClient,
  params: {
    worldId: string;
    createdBy: string;
    name: string;
    entityKind: string;
    aliases: string[];
  }
): Promise<EntitySummary> {
  const [slug, displayOrder] = await Promise.all([
    generateUniqueEntitySlug(supabase, params.worldId),
    maxEntityDisplayOrderForKind(supabase, params.worldId, params.entityKind).then((max) => max + 1000),
  ]);
  const entity = await insertEntity(supabase, { ...params, slug, displayOrder });
  await recordEntityRevision(supabase, { entity, changeSource: "user", changedBy: params.createdBy });
  return entity;
}

/** Glisser-depose (V2-G9) : une seule colonne, une seule ligne — copie de reorderBlock (src/server/services/blocks.ts). */
export async function reorderEntity(
  supabase: TypedClient,
  params: { id: string; expectedVersion: number; displayOrder: number }
): Promise<{ ok: true; entity: EntitySummary } | { ok: false; reason: "conflict" }> {
  const entity = await updateEntityDisplayOrder(supabase, params);
  if (!entity) return { ok: false, reason: "conflict" };
  return { ok: true, entity };
}

export type UpdateEntityResult =
  | { ok: true; entity: EntitySummary }
  | { ok: false; reason: "conflict" | "not_found" };

export async function updateEntity(
  supabase: TypedClient,
  params: {
    id: string;
    changedBy: string;
    expectedVersion: number;
    name: string;
    entityKind: string;
    aliases: string[];
  }
): Promise<UpdateEntityResult> {
  const updated = await updateEntityWithVersionCheck(supabase, params);
  if (!updated) {
    // Version perimee ou entite absente/inaccessible (RLS) : on ne peut
    // pas distinguer les deux sans une lecture supplementaire, et ca ne
    // changerait rien cote appelant (409 dans les deux cas est correct :
    // "not_found" resterait un echec d'ecriture, pas un 404 de lecture).
    const stillExists = await getEntityById(supabase, params.id);
    return { ok: false, reason: stillExists ? "conflict" : "not_found" };
  }

  await recordEntityRevision(supabase, { entity: updated, changeSource: "user", changedBy: params.changedBy });

  return { ok: true, entity: updated };
}

/** Idempotent (voir softDeleteEntity) — un menu qui rappelle "Supprimer" deux fois de suite ne doit jamais lever d'erreur. */
export async function deleteEntity(supabase: TypedClient, id: string): Promise<{ deleted: boolean }> {
  return softDeleteEntity(supabase, id);
}

/**
 * Copie la fiche (nouveau slug, nom suffixe) et ses blocs — jamais les
 * relations (un graphe de relations duplique serait ambigu : la copie
 * "parle" comme l'original a des entites qui, elles, n'ont pas change) ni
 * le portrait (V2-G7, hors perimetre demande).
 */
export async function duplicateEntity(
  supabase: TypedClient,
  params: { id: string; duplicatedBy: string }
): Promise<EntitySummary | null> {
  const original = await getEntityById(supabase, params.id);
  if (!original) return null;

  const [slug, displayOrder] = await Promise.all([
    generateUniqueEntitySlug(supabase, original.world_id),
    maxEntityDisplayOrderForKind(supabase, original.world_id, original.entity_kind).then((max) => max + 1000),
  ]);
  const copy = await insertEntity(supabase, {
    worldId: original.world_id,
    createdBy: params.duplicatedBy,
    slug,
    name: `${original.name} (copie)`,
    entityKind: original.entity_kind,
    aliases: original.aliases,
    displayOrder,
  });
  await recordEntityRevision(supabase, { entity: copy, changeSource: "user", changedBy: params.duplicatedBy });

  const blocks = await listBlocksForEntity(supabase, original.id);
  for (const block of blocks) {
    await insertBlock(supabase, {
      entityId: copy.id,
      blockType: block.block_type,
      display: block.display,
      data: block.data,
      displayOrder: block.display_order,
      visibilityLevel: block.visibility_level,
      visibilityScopeId: block.visibility_scope_id,
      createdBy: params.duplicatedBy,
    });
  }

  return copy;
}

/** Une requete vide ne vaut pas la peine d'un aller-retour base (docs/BACKLOG.md V0-06). */
export async function searchEntities(
  supabase: TypedClient,
  worldId: string,
  query: string
): Promise<EntitySearchResult[]> {
  const trimmed = query.trim();
  if (trimmed === "") return [];
  return searchEntitiesInWorld(supabase, worldId, trimmed);
}
