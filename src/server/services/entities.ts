import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { nextSlugCandidate, slugify } from "@/src/core/slug/slug";
import type { NarrativeContent } from "@/src/core/schemas/entities/segments";
import { buildEntityTree, type EntityTreeGroup } from "@/src/core/entity-tree/build-tree";
import {
  type EntitySummary,
  getEntityById,
  insertEntity,
  insertEntityRevision,
  listEntitiesForWorld,
  nextRevisionNumber,
  updateEntityWithVersionCheck,
  worldHasSlug,
} from "@/src/server/repos/entities";
import { listPartOfRelationsForWorld } from "@/src/server/repos/relations";

type TypedClient = SupabaseClient<Database>;

const MAX_SLUG_ATTEMPTS = 50;

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

async function generateUniqueEntitySlug(
  supabase: TypedClient,
  worldId: string,
  name: string
): Promise<string> {
  const base = slugify(name);
  const baseSlug = base === "" ? "entite" : base;

  for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
    const candidate = attempt === 0 ? baseSlug : nextSlugCandidate(baseSlug, attempt);
    if (!(await worldHasSlug(supabase, worldId, candidate))) {
      return candidate;
    }
  }
  throw new Error("Impossible de generer un slug unique.");
}

function snapshotOf(entity: EntitySummary) {
  // Snapshot complet plutot que diff (SCHEMA.md §15). Les blocs n'existent
  // pas encore (V0-04) : le snapshot ne porte que l'entite pour l'instant.
  const { id, world_id, slug, name, entity_kind, summary, aliases, tags, narrative_content, version } =
    entity;
  return { id, world_id, slug, name, entity_kind, summary, aliases, tags, narrative_content, version };
}

export async function createEntity(
  supabase: TypedClient,
  params: {
    worldId: string;
    createdBy: string;
    name: string;
    entityKind: string;
    summary: string;
    aliases: string[];
    tags: string[];
    narrativeContent: NarrativeContent;
  }
): Promise<EntitySummary> {
  const slug = await generateUniqueEntitySlug(supabase, params.worldId, params.name);
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
    summary: string;
    aliases: string[];
    tags: string[];
    narrativeContent: NarrativeContent;
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
