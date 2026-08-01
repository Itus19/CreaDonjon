import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { nextNumericSlug } from "@/src/core/slug/slug";
import { buildEntityTree, type EntityTreeGroup } from "@/src/core/entity-tree/build-tree";
import {
  type EntitySearchResult,
  type EntitySummary,
  getEntityById,
  insertEntity,
  insertEntityRevision,
  listEntitiesForWorld,
  listEntitySlugsForWorld,
  nextRevisionNumber,
  searchEntitiesInWorld,
  updateEntityWithVersionCheck,
  worldHasSlug,
} from "@/src/server/repos/entities";
import { listPartOfRelationsForWorld } from "@/src/server/repos/relations";

type TypedClient = SupabaseClient<Database>;

export async function listEntities(supabase: TypedClient, worldId: string): Promise<EntitySummary[]> {
  return listEntitiesForWorld(supabase, worldId);
}

/** Barre laterale (specs/coquille-et-design.md §4.3) : arborescence derivee, jamais saisie. */
export async function getEntityTree(
  supabase: TypedClient,
  worldId: string
): Promise<EntityTreeGroup[]> {
  const [entities, partOfEdges] = await Promise.all([
    listEntitiesForWorld(supabase, worldId),
    listPartOfRelationsForWorld(supabase, worldId),
  ]);
  return buildEntityTree(entities, partOfEdges);
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

function snapshotOf(entity: EntitySummary) {
  // Snapshot complet plutot que diff (SCHEMA.md §15). Les blocs n'existent
  // pas encore (V0-04) : le snapshot ne porte que l'entite pour l'instant.
  const { id, world_id, slug, name, entity_kind, aliases, version } = entity;
  return { id, world_id, slug, name, entity_kind, aliases, version };
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
  const slug = await generateUniqueEntitySlug(supabase, params.worldId);
  const entity = await insertEntity(supabase, { ...params, slug });
  await insertEntityRevision(supabase, {
    entityId: entity.id,
    revisionNumber: 1,
    snapshot: snapshotOf(entity),
    changeSource: "user",
    changedBy: params.createdBy,
  });
  return entity;
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

  const revisionNumber = await nextRevisionNumber(supabase, updated.id);
  await insertEntityRevision(supabase, {
    entityId: updated.id,
    revisionNumber,
    snapshot: snapshotOf(updated),
    changeSource: "user",
    changedBy: params.changedBy,
  });

  return { ok: true, entity: updated };
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
