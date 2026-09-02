import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";

type TypedClient = SupabaseClient<Database>;

export interface MapLayerRow {
  id: string;
  block_id: string;
  name: string;
  display_order: number;
  visibility_level: string;
  visibility_scope_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

const MAP_LAYER_COLUMNS = "id, block_id, name, display_order, visibility_level, visibility_scope_id, created_by, created_at, updated_at";

export async function listLayersForBlock(supabase: TypedClient, blockId: string): Promise<MapLayerRow[]> {
  const { data, error } = await supabase.from("map_layers").select(MAP_LAYER_COLUMNS).eq("block_id", blockId).order("display_order");
  if (error) throw new Error(error.message);
  return data;
}

export async function getLayerById(supabase: TypedClient, id: string): Promise<MapLayerRow | null> {
  const { data, error } = await supabase.from("map_layers").select(MAP_LAYER_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** Le plus grand `display_order` actuel du bloc, pour ajouter une couche en fin de liste — meme motif que `maxDisplayOrder` (blocks). */
export async function maxLayerDisplayOrder(supabase: TypedClient, blockId: string): Promise<number> {
  const { data, error } = await supabase
    .from("map_layers")
    .select("display_order")
    .eq("block_id", blockId)
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.display_order ?? 0;
}

export async function insertLayer(
  supabase: TypedClient,
  params: {
    blockId: string;
    name: string;
    displayOrder: number;
    visibilityLevel: string;
    visibilityScopeId: string | null;
    createdBy: string;
  }
): Promise<MapLayerRow> {
  const { data, error } = await supabase
    .from("map_layers")
    .insert({
      block_id: params.blockId,
      name: params.name,
      display_order: params.displayOrder,
      visibility_level: params.visibilityLevel,
      visibility_scope_id: params.visibilityScopeId,
      created_by: params.createdBy,
    })
    .select(MAP_LAYER_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateLayer(
  supabase: TypedClient,
  params: {
    id: string;
    name?: string;
    displayOrder?: number;
    visibilityLevel?: string;
    visibilityScopeId?: string | null;
  }
): Promise<MapLayerRow | null> {
  const patch: Database["public"]["Tables"]["map_layers"]["Update"] = {};
  if (params.name !== undefined) patch.name = params.name;
  if (params.displayOrder !== undefined) patch.display_order = params.displayOrder;
  if (params.visibilityLevel !== undefined) patch.visibility_level = params.visibilityLevel;
  if (params.visibilityScopeId !== undefined) patch.visibility_scope_id = params.visibilityScopeId;

  const { data, error } = await supabase.from("map_layers").update(patch).eq("id", params.id).select(MAP_LAYER_COLUMNS).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteLayer(supabase: TypedClient, id: string): Promise<boolean> {
  const { data, error } = await supabase.from("map_layers").delete().eq("id", id).select("id").maybeSingle();
  if (error) throw new Error(error.message);
  return data !== null;
}
