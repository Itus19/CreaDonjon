import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";

type TypedClient = SupabaseClient<Database>;

export interface MapRegionRow {
  id: string;
  block_id: string;
  name: string;
  ref: Json | null;
  shape: Json;
  fill_color: string;
  border_color: string;
  layer_id: string | null;
  visibility_level: string;
  visibility_scope_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

const MAP_REGION_COLUMNS =
  "id, block_id, name, ref, shape, fill_color, border_color, layer_id, visibility_level, visibility_scope_id, created_by, created_at, updated_at";

export async function listRegionsForBlock(supabase: TypedClient, blockId: string): Promise<MapRegionRow[]> {
  const { data, error } = await supabase.from("map_regions").select(MAP_REGION_COLUMNS).eq("block_id", blockId);
  if (error) throw new Error(error.message);
  return data;
}

export async function getRegionById(supabase: TypedClient, id: string): Promise<MapRegionRow | null> {
  const { data, error } = await supabase.from("map_regions").select(MAP_REGION_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function insertRegion(
  supabase: TypedClient,
  params: {
    blockId: string;
    name: string;
    ref: Json | null;
    shape: Json;
    fillColor: string;
    borderColor: string;
    layerId: string | null;
    visibilityLevel: string;
    visibilityScopeId: string | null;
    createdBy: string;
  }
): Promise<MapRegionRow> {
  const { data, error } = await supabase
    .from("map_regions")
    .insert({
      block_id: params.blockId,
      name: params.name,
      ref: params.ref,
      shape: params.shape,
      fill_color: params.fillColor,
      border_color: params.borderColor,
      layer_id: params.layerId,
      visibility_level: params.visibilityLevel,
      visibility_scope_id: params.visibilityScopeId,
      created_by: params.createdBy,
    })
    .select(MAP_REGION_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateRegion(
  supabase: TypedClient,
  params: {
    id: string;
    name?: string;
    ref?: Json | null;
    shape?: Json;
    fillColor?: string;
    borderColor?: string;
    layerId?: string | null;
    visibilityLevel?: string;
    visibilityScopeId?: string | null;
  }
): Promise<MapRegionRow | null> {
  const patch: Database["public"]["Tables"]["map_regions"]["Update"] = {};
  if (params.name !== undefined) patch.name = params.name;
  if (params.ref !== undefined) patch.ref = params.ref;
  if (params.shape !== undefined) patch.shape = params.shape;
  if (params.fillColor !== undefined) patch.fill_color = params.fillColor;
  if (params.borderColor !== undefined) patch.border_color = params.borderColor;
  if (params.layerId !== undefined) patch.layer_id = params.layerId;
  if (params.visibilityLevel !== undefined) patch.visibility_level = params.visibilityLevel;
  if (params.visibilityScopeId !== undefined) patch.visibility_scope_id = params.visibilityScopeId;

  const { data, error } = await supabase.from("map_regions").update(patch).eq("id", params.id).select(MAP_REGION_COLUMNS).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteRegion(supabase: TypedClient, id: string): Promise<boolean> {
  const { data, error } = await supabase.from("map_regions").delete().eq("id", id).select("id").maybeSingle();
  if (error) throw new Error(error.message);
  return data !== null;
}
