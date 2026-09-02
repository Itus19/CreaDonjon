import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import { filterBlocks, type VisibilityLevel, type Viewer } from "@/src/core/visibility";
import { zMapElementRef, type MapElementRef } from "@/src/core/schemas/mapElementRef";
import { zMapRegionShape, type MapRegionShape } from "@/src/core/schemas/mapRegion";
import {
  deleteRegion as repoDeleteRegion,
  getRegionById,
  insertRegion,
  listRegionsForBlock,
  updateRegion as repoUpdateRegion,
  type MapRegionRow,
} from "@/src/server/repos/mapRegions";
import { getBlockById } from "@/src/server/repos/blocks";
import { listEntitiesByIds } from "@/src/server/repos/entities";
import { canUserEditEntityById } from "@/src/server/services/permissions";
import { layerAllows, resolveLayerVisibilityByBlock } from "@/src/server/services/mapLayers";

type TypedClient = SupabaseClient<Database>;

export interface VisibleMapRegion {
  id: string;
  blockId: string;
  name: string;
  ref: MapElementRef | null;
  /** Resolu ici (jamais confie au client), meme discipline que `VisibleMapPin.refEntity`. */
  refEntity: { name: string; slug: string } | null;
  shape: MapRegionShape;
  fillColor: string;
  borderColor: string;
  layerId: string | null;
  visibilityLevel: string;
  visibilityScopeId: string | null;
}

function toVisibilityAware(row: MapRegionRow) {
  return {
    ...row,
    visibility: { level: row.visibility_level as VisibilityLevel, scopeId: row.visibility_scope_id, createdBy: row.created_by },
  };
}

function parseRef(ref: Json | null): MapElementRef | null {
  if (!ref) return null;
  const parsed = zMapElementRef.safeParse(ref);
  return parsed.success ? parsed.data : null;
}

function parseShape(shape: Json): MapRegionShape {
  const parsed = zMapRegionShape.safeParse(shape);
  return parsed.success ? parsed.data : [];
}

/**
 * Zones visibles par CE viewer (Lot I, phases D et E) — meme discipline
 * que `listVisibleMapPins`, y compris la regle "ET" de la couche assignee
 * (ADR 0017 decision 2).
 */
export async function listVisibleMapRegions(supabase: TypedClient, blockId: string, viewer: Viewer): Promise<VisibleMapRegion[]> {
  const [rows, layerVisibilityById] = await Promise.all([listRegionsForBlock(supabase, blockId), resolveLayerVisibilityByBlock(supabase, blockId)]);
  const visible = filterBlocks(rows.map(toVisibilityAware), viewer).filter((row) => layerAllows(row.layer_id, layerVisibilityById, viewer));

  const entityIds = new Set<string>();
  for (const row of visible) {
    const ref = parseRef(row.ref);
    if (ref) entityIds.add(ref.id);
  }
  const entities = entityIds.size > 0 ? await listEntitiesByIds(supabase, [...entityIds]) : [];
  const entityById = new Map(entities.map((e) => [e.id, e]));

  return visible.map((row) => {
    const ref = parseRef(row.ref);
    const entity = ref ? entityById.get(ref.id) : undefined;
    return {
      id: row.id,
      blockId: row.block_id,
      name: row.name,
      ref,
      refEntity: entity ? { name: entity.name, slug: entity.slug } : null,
      shape: parseShape(row.shape),
      fillColor: row.fill_color,
      borderColor: row.border_color,
      layerId: row.layer_id,
      visibilityLevel: row.visibility_level,
      visibilityScopeId: row.visibility_scope_id,
    };
  });
}

export type MapRegionMutationResult = { ok: true; region: MapRegionRow } | { ok: false; reason: "forbidden" | "not_found" };

export async function createMapRegion(
  supabase: TypedClient,
  params: {
    blockId: string;
    name: string;
    ref: MapElementRef | null;
    shape: MapRegionShape;
    fillColor: string;
    borderColor: string;
    layerId: string | null;
    visibilityLevel: string;
    visibilityScopeId: string | null;
    createdBy: string;
  }
): Promise<MapRegionMutationResult> {
  const block = await getBlockById(supabase, params.blockId);
  if (!block) return { ok: false, reason: "not_found" };
  const allowed = await canUserEditEntityById(supabase, { entityId: block.entity_id, userId: params.createdBy });
  if (!allowed) return { ok: false, reason: "forbidden" };

  const region = await insertRegion(supabase, {
    blockId: params.blockId,
    name: params.name,
    ref: params.ref as unknown as Json,
    shape: params.shape as unknown as Json,
    fillColor: params.fillColor,
    borderColor: params.borderColor,
    layerId: params.layerId,
    visibilityLevel: params.visibilityLevel,
    visibilityScopeId: params.visibilityScopeId,
    createdBy: params.createdBy,
  });
  return { ok: true, region };
}

export async function updateMapRegion(
  supabase: TypedClient,
  params: {
    id: string;
    userId: string;
    name?: string;
    ref?: MapElementRef | null;
    shape?: MapRegionShape;
    fillColor?: string;
    borderColor?: string;
    layerId?: string | null;
    visibilityLevel?: string;
    visibilityScopeId?: string | null;
  }
): Promise<MapRegionMutationResult> {
  const existing = await getRegionById(supabase, params.id);
  if (!existing) return { ok: false, reason: "not_found" };
  const block = await getBlockById(supabase, existing.block_id);
  if (!block) return { ok: false, reason: "not_found" };
  const allowed = await canUserEditEntityById(supabase, { entityId: block.entity_id, userId: params.userId });
  if (!allowed) return { ok: false, reason: "forbidden" };

  const updated = await repoUpdateRegion(supabase, {
    id: params.id,
    name: params.name,
    ref: params.ref === undefined ? undefined : (params.ref as unknown as Json),
    shape: params.shape === undefined ? undefined : (params.shape as unknown as Json),
    fillColor: params.fillColor,
    borderColor: params.borderColor,
    layerId: params.layerId,
    visibilityLevel: params.visibilityLevel,
    visibilityScopeId: params.visibilityScopeId,
  });
  if (!updated) return { ok: false, reason: "not_found" };
  return { ok: true, region: updated };
}

export async function deleteMapRegion(supabase: TypedClient, params: { id: string; userId: string }): Promise<{ ok: true } | { ok: false; reason: "forbidden" | "not_found" }> {
  const existing = await getRegionById(supabase, params.id);
  if (!existing) return { ok: false, reason: "not_found" };
  const block = await getBlockById(supabase, existing.block_id);
  if (!block) return { ok: false, reason: "not_found" };
  const allowed = await canUserEditEntityById(supabase, { entityId: block.entity_id, userId: params.userId });
  if (!allowed) return { ok: false, reason: "forbidden" };

  const deleted = await repoDeleteRegion(supabase, params.id);
  return deleted ? { ok: true } : { ok: false, reason: "not_found" };
}
