import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";

type TypedClient = SupabaseClient<Database>;

export interface MapPinRow {
  id: string;
  block_id: string;
  x: number;
  y: number;
  label: string;
  ref: Json | null;
  size: string;
  layer_id: string | null;
  visibility_level: string;
  visibility_scope_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

const MAP_PIN_COLUMNS = "id, block_id, x, y, label, ref, size, layer_id, visibility_level, visibility_scope_id, created_by, created_at, updated_at";

export async function listPinsForBlock(supabase: TypedClient, blockId: string): Promise<MapPinRow[]> {
  const { data, error } = await supabase.from("map_pins").select(MAP_PIN_COLUMNS).eq("block_id", blockId);
  if (error) throw new Error(error.message);
  return data;
}

export async function getPinById(supabase: TypedClient, id: string): Promise<MapPinRow | null> {
  const { data, error } = await supabase.from("map_pins").select(MAP_PIN_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function insertPin(
  supabase: TypedClient,
  params: {
    blockId: string;
    x: number;
    y: number;
    label: string;
    ref: Json | null;
    size: string;
    layerId: string | null;
    visibilityLevel: string;
    visibilityScopeId: string | null;
    createdBy: string;
  }
): Promise<MapPinRow> {
  const { data, error } = await supabase
    .from("map_pins")
    .insert({
      block_id: params.blockId,
      x: params.x,
      y: params.y,
      label: params.label,
      ref: params.ref,
      size: params.size,
      layer_id: params.layerId,
      visibility_level: params.visibilityLevel,
      visibility_scope_id: params.visibilityScopeId,
      created_by: params.createdBy,
    })
    .select(MAP_PIN_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updatePin(
  supabase: TypedClient,
  params: {
    id: string;
    x?: number;
    y?: number;
    label?: string;
    ref?: Json | null;
    size?: string;
    layerId?: string | null;
    visibilityLevel?: string;
    visibilityScopeId?: string | null;
  }
): Promise<MapPinRow | null> {
  const patch: Database["public"]["Tables"]["map_pins"]["Update"] = {};
  if (params.x !== undefined) patch.x = params.x;
  if (params.y !== undefined) patch.y = params.y;
  if (params.label !== undefined) patch.label = params.label;
  if (params.ref !== undefined) patch.ref = params.ref;
  if (params.size !== undefined) patch.size = params.size;
  if (params.layerId !== undefined) patch.layer_id = params.layerId;
  if (params.visibilityLevel !== undefined) patch.visibility_level = params.visibilityLevel;
  if (params.visibilityScopeId !== undefined) patch.visibility_scope_id = params.visibilityScopeId;

  const { data, error } = await supabase.from("map_pins").update(patch).eq("id", params.id).select(MAP_PIN_COLUMNS).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function deletePin(supabase: TypedClient, id: string): Promise<boolean> {
  const { data, error } = await supabase.from("map_pins").delete().eq("id", id).select("id").maybeSingle();
  if (error) throw new Error(error.message);
  return data !== null;
}
