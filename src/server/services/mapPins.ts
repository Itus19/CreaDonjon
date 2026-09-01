import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import { filterBlocks, type VisibilityLevel, type Viewer } from "@/src/core/visibility";
import { zMapPinRef, type MapPinRef } from "@/src/core/schemas/mapPin";
import {
  deletePin as repoDeletePin,
  getPinById,
  insertPin,
  listPinsForBlock,
  updatePin as repoUpdatePin,
  type MapPinRow,
} from "@/src/server/repos/mapPins";
import { getBlockById } from "@/src/server/repos/blocks";
import { listEntitiesByIds } from "@/src/server/repos/entities";
import { canUserEditEntityById } from "@/src/server/services/permissions";

type TypedClient = SupabaseClient<Database>;

export interface VisibleMapPin {
  id: string;
  blockId: string;
  x: number;
  y: number;
  label: string;
  ref: MapPinRef | null;
  /** Resolu ici (jamais confie au client) : nom/slug de la fiche liee, seulement si elle existe encore et reste visible a CE viewer — un lien mort disparait plutot que de reveler l'existence d'une fiche cachee. */
  refEntity: { name: string; slug: string } | null;
  size: string;
  visibilityLevel: string;
  visibilityScopeId: string | null;
}

function toVisibilityAware(row: MapPinRow) {
  return {
    ...row,
    visibility: { level: row.visibility_level as VisibilityLevel, scopeId: row.visibility_scope_id, createdBy: row.created_by },
  };
}

function parseRef(ref: Json | null): MapPinRef | null {
  if (!ref) return null;
  const parsed = zMapPinRef.safeParse(ref);
  return parsed.success ? parsed.data : null;
}

/**
 * Punaises visibles par CE viewer (Lot I, phase C) — meme filtrage que
 * `listVisibleBlocks` (src/server/services/blocks.ts), applique ici a
 * `map_pins`. Le lien d'une punaise vers une fiche est revalide
 * independamment (une punaise publique peut pointer vers une fiche masquee,
 * auquel cas seul `refEntity` disparait — la punaise elle-meme reste
 * visible avec son `label` libre).
 */
export async function listVisibleMapPins(supabase: TypedClient, blockId: string, viewer: Viewer): Promise<VisibleMapPin[]> {
  const rows = await listPinsForBlock(supabase, blockId);
  const visible = filterBlocks(rows.map(toVisibilityAware), viewer);

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
      x: row.x,
      y: row.y,
      label: row.label,
      ref,
      refEntity: entity ? { name: entity.name, slug: entity.slug } : null,
      size: row.size,
      visibilityLevel: row.visibility_level,
      visibilityScopeId: row.visibility_scope_id,
    };
  });
}

export type MapPinMutationResult = { ok: true; pin: MapPinRow } | { ok: false; reason: "forbidden" | "not_found" };

export async function createMapPin(
  supabase: TypedClient,
  params: {
    blockId: string;
    x: number;
    y: number;
    label: string;
    ref: MapPinRef | null;
    size: string;
    visibilityLevel: string;
    visibilityScopeId: string | null;
    createdBy: string;
  }
): Promise<MapPinMutationResult> {
  const block = await getBlockById(supabase, params.blockId);
  if (!block) return { ok: false, reason: "not_found" };
  const allowed = await canUserEditEntityById(supabase, { entityId: block.entity_id, userId: params.createdBy });
  if (!allowed) return { ok: false, reason: "forbidden" };

  const pin = await insertPin(supabase, {
    blockId: params.blockId,
    x: params.x,
    y: params.y,
    label: params.label,
    ref: params.ref as unknown as Json,
    size: params.size,
    visibilityLevel: params.visibilityLevel,
    visibilityScopeId: params.visibilityScopeId,
    createdBy: params.createdBy,
  });
  return { ok: true, pin };
}

export async function updateMapPin(
  supabase: TypedClient,
  params: {
    id: string;
    userId: string;
    x?: number;
    y?: number;
    label?: string;
    ref?: MapPinRef | null;
    size?: string;
    visibilityLevel?: string;
    visibilityScopeId?: string | null;
  }
): Promise<MapPinMutationResult> {
  const existing = await getPinById(supabase, params.id);
  if (!existing) return { ok: false, reason: "not_found" };
  const block = await getBlockById(supabase, existing.block_id);
  if (!block) return { ok: false, reason: "not_found" };
  const allowed = await canUserEditEntityById(supabase, { entityId: block.entity_id, userId: params.userId });
  if (!allowed) return { ok: false, reason: "forbidden" };

  const updated = await repoUpdatePin(supabase, {
    id: params.id,
    x: params.x,
    y: params.y,
    label: params.label,
    ref: params.ref === undefined ? undefined : (params.ref as unknown as Json),
    size: params.size,
    visibilityLevel: params.visibilityLevel,
    visibilityScopeId: params.visibilityScopeId,
  });
  if (!updated) return { ok: false, reason: "not_found" };
  return { ok: true, pin: updated };
}

export async function deleteMapPin(supabase: TypedClient, params: { id: string; userId: string }): Promise<{ ok: true } | { ok: false; reason: "forbidden" | "not_found" }> {
  const existing = await getPinById(supabase, params.id);
  if (!existing) return { ok: false, reason: "not_found" };
  const block = await getBlockById(supabase, existing.block_id);
  if (!block) return { ok: false, reason: "not_found" };
  const allowed = await canUserEditEntityById(supabase, { entityId: block.entity_id, userId: params.userId });
  if (!allowed) return { ok: false, reason: "forbidden" };

  const deleted = await repoDeletePin(supabase, params.id);
  return deleted ? { ok: true } : { ok: false, reason: "not_found" };
}
