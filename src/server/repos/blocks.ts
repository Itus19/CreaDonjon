import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";

type TypedClient = SupabaseClient<Database>;

export interface BlockRow {
  id: string;
  entity_id: string;
  block_type: string;
  display: Json;
  data: Json;
  display_order: number;
  version: number;
  visibility_level: string;
  visibility_scope_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

const BLOCK_COLUMNS =
  "id, entity_id, block_type, display, data, display_order, version, visibility_level, visibility_scope_id, created_by, created_at, updated_at";

export async function listBlocksForEntity(supabase: TypedClient, entityId: string): Promise<BlockRow[]> {
  const { data, error } = await supabase
    .from("blocks")
    .select(BLOCK_COLUMNS)
    .eq("entity_id", entityId)
    .order("display_order");
  if (error) throw new Error(error.message);
  return data as BlockRow[];
}

export async function getBlockById(supabase: TypedClient, id: string): Promise<BlockRow | null> {
  const { data, error } = await supabase
    .from("blocks")
    .select(BLOCK_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as BlockRow | null;
}

/** Le plus grand `display_order` actuel de l'entite, pour ajouter un bloc en fin de liste. */
export async function maxDisplayOrder(supabase: TypedClient, entityId: string): Promise<number> {
  const { data, error } = await supabase
    .from("blocks")
    .select("display_order")
    .eq("entity_id", entityId)
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.display_order ?? 0;
}

export async function insertBlock(
  supabase: TypedClient,
  params: {
    entityId: string;
    blockType: string;
    display: Json;
    data: Json;
    displayOrder: number;
    visibilityLevel: string;
    visibilityScopeId: string | null;
    createdBy: string;
  }
): Promise<BlockRow> {
  const { data, error } = await supabase
    .from("blocks")
    .insert({
      entity_id: params.entityId,
      block_type: params.blockType,
      display: params.display,
      data: params.data,
      display_order: params.displayOrder,
      visibility_level: params.visibilityLevel,
      visibility_scope_id: params.visibilityScopeId,
      created_by: params.createdBy,
    })
    .select(BLOCK_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data as BlockRow;
}

/** `null` en retour signifie version perimee (concurrence optimiste), pas une erreur. */
export async function updateBlockWithVersionCheck(
  supabase: TypedClient,
  params: {
    id: string;
    expectedVersion: number;
    display: Json;
    data: Json;
    visibilityLevel: string;
    visibilityScopeId: string | null;
  }
): Promise<BlockRow | null> {
  const { data, error } = await supabase
    .from("blocks")
    .update({
      display: params.display,
      data: params.data,
      visibility_level: params.visibilityLevel,
      visibility_scope_id: params.visibilityScopeId,
      version: params.expectedVersion + 1,
    })
    .eq("id", params.id)
    .eq("version", params.expectedVersion)
    .select(BLOCK_COLUMNS)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as BlockRow | null;
}

/**
 * Reordonnancement : une seule colonne, une seule ligne (docs/BACKLOG.md
 * V0-04). `display_order` est un `numeric` : inserer entre le 3e et le 4e
 * bloc s'ecrit 3.5, jamais une reecriture de toute la liste.
 */
export async function updateBlockDisplayOrder(
  supabase: TypedClient,
  params: { id: string; expectedVersion: number; displayOrder: number }
): Promise<BlockRow | null> {
  const { data, error } = await supabase
    .from("blocks")
    .update({ display_order: params.displayOrder, version: params.expectedVersion + 1 })
    .eq("id", params.id)
    .eq("version", params.expectedVersion)
    .select(BLOCK_COLUMNS)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as BlockRow | null;
}

export async function deleteBlock(supabase: TypedClient, id: string): Promise<void> {
  const { error } = await supabase.from("blocks").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
