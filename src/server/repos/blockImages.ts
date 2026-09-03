import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";

type TypedClient = SupabaseClient<Database>;

/** Teinte/chroma derivees (V2-G13) — jamais recalculees a l'affichage, calculees une fois au televersement. */
export interface BlockImageBackgroundMeta {
  hue: number;
  chroma: number;
  availableModes: string[];
}

/**
 * Une seule ligne par bloc (cle primaire) : un nouveau televersement
 * remplace l'ancien de fait. `assetId` (V2-L1) — les octets vivent
 * desormais dans `assets`/Storage (`storage.ts`), cette table ne garde que
 * le pointeur et les metadonnees de fond deja calculees (hue/chroma).
 */
export async function upsertBlockImage(
  supabase: TypedClient,
  params: {
    blockId: string;
    assetId: string;
    hue: number;
    chroma: number;
    availableModes: string[];
  }
): Promise<void> {
  const { error } = await supabase.from("block_images").upsert({
    block_id: params.blockId,
    asset_id: params.assetId,
    hue: params.hue,
    chroma: params.chroma,
    available_modes: params.availableModes,
  });
  if (error) throw new Error(error.message);
}

/** `null` tant que le pointeur n'est pas encore renseigne (avant le script de bascule V2-L1) ou si le bloc n'a pas d'image. */
export async function getBlockImageAssetId(supabase: TypedClient, blockId: string): Promise<string | null> {
  const { data, error } = await supabase.from("block_images").select("asset_id").eq("block_id", blockId).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.asset_id ?? null;
}

/** Metadonnees seules (jamais les octets) — pour composer le fond de la page wiki sans charger l'image entiere. */
export async function getBlockImageBackgroundMeta(
  supabase: TypedClient,
  blockId: string
): Promise<BlockImageBackgroundMeta | null> {
  const { data, error } = await supabase
    .from("block_images")
    .select("hue, chroma, available_modes")
    .eq("block_id", blockId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.hue === null || data.chroma === null) return null;
  return { hue: data.hue, chroma: data.chroma, availableModes: data.available_modes ?? [] };
}

export async function deleteBlockImage(supabase: TypedClient, blockId: string): Promise<void> {
  const { error } = await supabase.from("block_images").delete().eq("block_id", blockId);
  if (error) throw new Error(error.message);
}
