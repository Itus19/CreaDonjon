import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";

type TypedClient = SupabaseClient<Database>;

export interface AssetRow {
  id: string;
  world_id: string;
  storage_path: string;
  mime_type: string;
  byte_size: number;
  width: number | null;
  height: number | null;
  alt_text: string | null;
  visibility_level: string;
  visibility_scope_id: string | null;
  uploaded_by: string | null;
  created_at: string;
}

const ASSET_COLUMNS = "id, world_id, storage_path, mime_type, byte_size, width, height, alt_text, visibility_level, visibility_scope_id, uploaded_by, created_at";

export async function insertAsset(
  supabase: TypedClient,
  params: {
    /** Fixe d'avance (retour appelant, `storage.ts`) : le chemin de stockage encode ce meme id (`${worldId}/${id}.webp`), jamais decouvert apres coup. */
    id: string;
    worldId: string;
    storagePath: string;
    mimeType: string;
    byteSize: number;
    width: number | null;
    height: number | null;
    altText: string | null;
    visibilityLevel: string;
    visibilityScopeId: string | null;
    uploadedBy: string;
  }
): Promise<AssetRow> {
  const { data, error } = await supabase
    .from("assets")
    .insert({
      id: params.id,
      world_id: params.worldId,
      storage_path: params.storagePath,
      mime_type: params.mimeType,
      byte_size: params.byteSize,
      width: params.width,
      height: params.height,
      alt_text: params.altText,
      visibility_level: params.visibilityLevel,
      visibility_scope_id: params.visibilityScopeId,
      uploaded_by: params.uploadedBy,
    })
    .select(ASSET_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/** RLS `assets_select` (app.visibility_permits) filtre deja par visibilite — `null` couvre a la fois "introuvable" et "hors de portee pour ce viewer", jamais distingue (meme convention que le portrait). */
export async function getAssetById(supabase: TypedClient, id: string): Promise<AssetRow | null> {
  const { data, error } = await supabase.from("assets").select(ASSET_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteAssetRow(supabase: TypedClient, id: string): Promise<boolean> {
  const { data, error } = await supabase.from("assets").delete().eq("id", id).select("id").maybeSingle();
  if (error) throw new Error(error.message);
  return data !== null;
}
