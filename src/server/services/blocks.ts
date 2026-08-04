import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import { filterBlocks, type VisibilityLevel } from "@/src/core/visibility";
import type { BlockDisplay } from "@/src/core/schemas/blocks/envelope";
import {
  BLOCK_TYPES,
  type BlockType,
  dataSchemaForBlockType,
  defaultBlockData,
  defaultBlockDisplay,
} from "@/src/core/schemas/blocks/registry";
import {
  type BlockRow,
  deleteBlock as repoDeleteBlock,
  getBlockById,
  insertBlock,
  listBlocksForEntity,
  maxDisplayOrder,
  updateBlockDisplayOrder,
  updateBlockWithVersionCheck,
} from "@/src/server/repos/blocks";
import { getEntityById } from "@/src/server/repos/entities";
import { buildViewerForWorld } from "@/src/server/services/visibility";
import { recordEntityRevision } from "@/src/server/services/entityHistory";

type TypedClient = SupabaseClient<Database>;

export interface VisibleBlock {
  id: string;
  entityId: string;
  blockType: string;
  display: BlockDisplay;
  data: Json;
  displayOrder: number;
  version: number;
  visibilityLevel: string;
  visibilityScopeId: string | null;
}

function toVisibleBlock(row: BlockRow): VisibleBlock {
  return {
    id: row.id,
    entityId: row.entity_id,
    blockType: row.block_type,
    display: row.display as unknown as BlockDisplay,
    data: row.data,
    displayOrder: row.display_order,
    version: row.version,
    visibilityLevel: row.visibility_level,
    visibilityScopeId: row.visibility_scope_id,
  };
}

function toVisibilityAware(row: BlockRow) {
  return {
    ...row,
    visibility: {
      level: row.visibility_level as VisibilityLevel,
      scopeId: row.visibility_scope_id,
      createdBy: row.created_by,
    },
  };
}

/**
 * Liste filtree par visibilite (docs/SCHEMA.md §4.2, §19.2) : la RLS ne
 * filtre que l'appartenance au monde, la visibilite fine (public/players/
 * gm/...) est resolue ici, cote service, avant l'envoi.
 */
export async function listVisibleBlocks(
  supabase: TypedClient,
  worldId: string,
  entityId: string,
  userId: string
): Promise<VisibleBlock[]> {
  const [rows, viewer] = await Promise.all([
    listBlocksForEntity(supabase, entityId),
    buildViewerForWorld(supabase, worldId, userId),
  ]);
  const visible = filterBlocks(rows.map(toVisibilityAware), viewer);
  return visible.map(toVisibleBlock);
}

function isBlockType(value: string): value is BlockType {
  return (BLOCK_TYPES as readonly string[]).includes(value);
}

/** Edition redactionnelle d'un bloc = nouvelle revision de son entite (V1-C3, specs/wiki-blocs.md §4.5). */
async function recordBlockRevision(supabase: TypedClient, entityId: string, changedBy: string): Promise<void> {
  const entity = await getEntityById(supabase, entityId);
  if (!entity) return;
  await recordEntityRevision(supabase, { entity, changeSource: "user", changedBy });
}

export async function createBlock(
  supabase: TypedClient,
  params: {
    entityId: string;
    blockType: string;
    label: string;
    visibilityLevel: string;
    visibilityScopeId: string | null;
    createdBy: string;
  }
): Promise<VisibleBlock> {
  if (!isBlockType(params.blockType)) {
    throw new Error(`Type de bloc inconnu : ${params.blockType}`);
  }

  const display = defaultBlockDisplay(params.blockType, params.label);
  const data = defaultBlockData(params.blockType);
  const displayOrder = (await maxDisplayOrder(supabase, params.entityId)) + 1000;

  const row = await insertBlock(supabase, {
    entityId: params.entityId,
    blockType: params.blockType,
    display,
    data: data as Json,
    displayOrder,
    visibilityLevel: params.visibilityLevel,
    visibilityScopeId: params.visibilityScopeId,
    createdBy: params.createdBy,
  });
  await recordBlockRevision(supabase, params.entityId, params.createdBy);
  return toVisibleBlock(row);
}

export async function updateBlockContent(
  supabase: TypedClient,
  params: {
    id: string;
    expectedVersion: number;
    display: Json;
    data: unknown;
    visibilityLevel: string;
    visibilityScopeId: string | null;
    changedBy: string;
  }
): Promise<{ ok: true; block: VisibleBlock } | { ok: false; reason: "conflict" | "not_found" }> {
  const existing = await getBlockById(supabase, params.id);
  if (!existing) return { ok: false, reason: "not_found" };
  if (!isBlockType(existing.block_type)) {
    throw new Error(`Type de bloc inconnu en base : ${existing.block_type}`);
  }

  const validatedData = dataSchemaForBlockType(existing.block_type).parse(params.data);

  const row = await updateBlockWithVersionCheck(supabase, {
    id: params.id,
    expectedVersion: params.expectedVersion,
    display: params.display,
    data: validatedData as Json,
    visibilityLevel: params.visibilityLevel,
    visibilityScopeId: params.visibilityScopeId,
  });
  if (!row) return { ok: false, reason: "conflict" };
  await recordBlockRevision(supabase, existing.entity_id, params.changedBy);
  return { ok: true, block: toVisibleBlock(row) };
}

export async function reorderBlock(
  supabase: TypedClient,
  params: { id: string; expectedVersion: number; displayOrder: number }
): Promise<{ ok: true; block: VisibleBlock } | { ok: false; reason: "conflict" }> {
  const row = await updateBlockDisplayOrder(supabase, params);
  if (!row) return { ok: false, reason: "conflict" };
  return { ok: true, block: toVisibleBlock(row) };
}

export async function deleteBlock(supabase: TypedClient, id: string, changedBy: string): Promise<void> {
  const existing = await getBlockById(supabase, id);
  await repoDeleteBlock(supabase, id);
  if (existing) await recordBlockRevision(supabase, existing.entity_id, changedBy);
}
