import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { canSee, filterBlocks, type VisibilityLevel, type VisibilitySubject, type Viewer } from "@/src/core/visibility";
import {
  deleteLayer as repoDeleteLayer,
  getLayerById,
  insertLayer,
  listLayersForBlock,
  maxLayerDisplayOrder,
  updateLayer as repoUpdateLayer,
  type MapLayerRow,
} from "@/src/server/repos/mapLayers";
import { getBlockById } from "@/src/server/repos/blocks";
import { canUserEditEntityById } from "@/src/server/services/permissions";

type TypedClient = SupabaseClient<Database>;

export interface VisibleMapLayer {
  id: string;
  blockId: string;
  name: string;
  displayOrder: number;
  visibilityLevel: string;
  visibilityScopeId: string | null;
}

function toVisibilityAware(row: MapLayerRow) {
  return {
    ...row,
    visibility: { level: row.visibility_level as VisibilityLevel, scopeId: row.visibility_scope_id, createdBy: row.created_by },
  };
}

function toVisibleLayer(row: MapLayerRow): VisibleMapLayer {
  return {
    id: row.id,
    blockId: row.block_id,
    name: row.name,
    displayOrder: row.display_order,
    visibilityLevel: row.visibility_level,
    visibilityScopeId: row.visibility_scope_id,
  };
}

/** Couches visibles par CE viewer (Lot I, phase E) — meme discipline que `listVisibleMapPins`/`listVisibleMapRegions`. Sert le panneau d'edition MJ ; jamais expose tel quel a un viewer anonyme/joueur (eux ne voient jamais la LISTE des couches, seulement son effet sur les punaises/zones — voir `resolveLayerVisibilityByBlock`). */
export async function listVisibleMapLayers(supabase: TypedClient, blockId: string, viewer: Viewer): Promise<VisibleMapLayer[]> {
  const rows = await listLayersForBlock(supabase, blockId);
  const visible = filterBlocks(rows.map(toVisibilityAware), viewer);
  return visible.map(toVisibleLayer);
}

/**
 * Visibilite de CHAQUE couche d'un bloc, pour resoudre la regle "ET" d'un
 * element assigne (ADR 0017 decision 2) — jamais la meme chose que
 * `listVisibleMapLayers` : ici on veut TOUTES les couches (memes celles que
 * ce viewer ne pourrait pas voir dans un panneau), seulement pour savoir si
 * CETTE couche precise permet CE viewer. Utilise par
 * `mapPins.ts`/`mapRegions.ts`, jamais reimplemente par appelant.
 */
export async function resolveLayerVisibilityByBlock(supabase: TypedClient, blockId: string): Promise<Map<string, VisibilitySubject>> {
  const rows = await listLayersForBlock(supabase, blockId);
  return new Map(
    rows.map((row) => [
      row.id,
      { level: row.visibility_level as VisibilityLevel, scopeId: row.visibility_scope_id, createdBy: row.created_by },
    ])
  );
}

/** Un element assigne a une couche n'est visible que si CETTE couche permet aussi ce viewer (ADR 0017 decision 2) — `layerId` `null` : aucune couche assignee, rien a verifier de plus. */
export function layerAllows(layerId: string | null, layerVisibilityById: Map<string, VisibilitySubject>, viewer: Viewer): boolean {
  if (!layerId) return true;
  const layerVisibility = layerVisibilityById.get(layerId);
  // Couche assignee mais introuvable (supprimee entre-temps, incoherence) :
  // cote le plus sur, jamais un element qui se retrouve visible parce que
  // sa couche a disparu.
  if (!layerVisibility) return false;
  return canSee(layerVisibility, viewer);
}

export type MapLayerMutationResult = { ok: true; layer: MapLayerRow } | { ok: false; reason: "forbidden" | "not_found" };

export async function createMapLayer(
  supabase: TypedClient,
  params: { blockId: string; name: string; visibilityLevel: string; visibilityScopeId: string | null; createdBy: string }
): Promise<MapLayerMutationResult> {
  const block = await getBlockById(supabase, params.blockId);
  if (!block) return { ok: false, reason: "not_found" };
  const allowed = await canUserEditEntityById(supabase, { entityId: block.entity_id, userId: params.createdBy });
  if (!allowed) return { ok: false, reason: "forbidden" };

  const displayOrder = (await maxLayerDisplayOrder(supabase, params.blockId)) + 1000;
  const layer = await insertLayer(supabase, {
    blockId: params.blockId,
    name: params.name,
    displayOrder,
    visibilityLevel: params.visibilityLevel,
    visibilityScopeId: params.visibilityScopeId,
    createdBy: params.createdBy,
  });
  return { ok: true, layer };
}

export async function updateMapLayer(
  supabase: TypedClient,
  params: {
    id: string;
    userId: string;
    name?: string;
    displayOrder?: number;
    visibilityLevel?: string;
    visibilityScopeId?: string | null;
  }
): Promise<MapLayerMutationResult> {
  const existing = await getLayerById(supabase, params.id);
  if (!existing) return { ok: false, reason: "not_found" };
  const block = await getBlockById(supabase, existing.block_id);
  if (!block) return { ok: false, reason: "not_found" };
  const allowed = await canUserEditEntityById(supabase, { entityId: block.entity_id, userId: params.userId });
  if (!allowed) return { ok: false, reason: "forbidden" };

  const updated = await repoUpdateLayer(supabase, {
    id: params.id,
    name: params.name,
    displayOrder: params.displayOrder,
    visibilityLevel: params.visibilityLevel,
    visibilityScopeId: params.visibilityScopeId,
  });
  if (!updated) return { ok: false, reason: "not_found" };
  return { ok: true, layer: updated };
}

export async function deleteMapLayer(supabase: TypedClient, params: { id: string; userId: string }): Promise<{ ok: true } | { ok: false; reason: "forbidden" | "not_found" }> {
  const existing = await getLayerById(supabase, params.id);
  if (!existing) return { ok: false, reason: "not_found" };
  const block = await getBlockById(supabase, existing.block_id);
  if (!block) return { ok: false, reason: "not_found" };
  const allowed = await canUserEditEntityById(supabase, { entityId: block.entity_id, userId: params.userId });
  if (!allowed) return { ok: false, reason: "forbidden" };

  const deleted = await repoDeleteLayer(supabase, params.id);
  return deleted ? { ok: true } : { ok: false, reason: "not_found" };
}
