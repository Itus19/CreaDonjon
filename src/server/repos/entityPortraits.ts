import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";

type TypedClient = SupabaseClient<Database>;

/** Un seul portrait par fiche (`entity_assets_one_portrait`, index unique partiel sur `role = 'portrait'`). */
export async function getEntityPortraitAssetId(supabase: TypedClient, entityId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("entity_assets")
    .select("asset_id")
    .eq("entity_id", entityId)
    .eq("role", "portrait")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.asset_id ?? null;
}

/**
 * Remplace le pointeur portrait de cette fiche par `assetId` (supprime
 * l'ancien puis insere le nouveau — jamais un UPDATE en place, l'`asset_id`
 * change a chaque televersement). La mise en page (`display_size_pct`/
 * `align`) est preservee si elle existait deja, sinon reprend les valeurs
 * par defaut des colonnes.
 */
export async function setEntityPortraitAsset(supabase: TypedClient, entityId: string, assetId: string): Promise<void> {
  const layout = await getEntityPortraitLayout(supabase, entityId);
  const { error: deleteError } = await supabase.from("entity_assets").delete().eq("entity_id", entityId).eq("role", "portrait");
  if (deleteError) throw new Error(deleteError.message);
  const { error: insertError } = await supabase.from("entity_assets").insert({
    entity_id: entityId,
    asset_id: assetId,
    role: "portrait",
    display_size_pct: layout.displaySizePct,
    align: layout.align,
  });
  if (insertError) throw new Error(insertError.message);
}

/** Retire le pointeur portrait de cette fiche, renvoie l'`asset_id` retire (`null` si aucun) pour que l'appelant nettoie l'asset sous-jacent. */
export async function removeEntityPortraitAsset(supabase: TypedClient, entityId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("entity_assets")
    .delete()
    .eq("entity_id", entityId)
    .eq("role", "portrait")
    .select("asset_id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.asset_id ?? null;
}

export interface EntityPortraitLayout {
  displaySizePct: number;
  align: "left" | "right";
}

const DEFAULT_PORTRAIT_LAYOUT: EntityPortraitLayout = { displaySizePct: 100, align: "right" };

/** Aucune ligne portrait pour cette fiche : l'appelant retombe sur les valeurs par defaut, jamais une erreur. */
export async function getEntityPortraitLayout(supabase: TypedClient, entityId: string): Promise<EntityPortraitLayout> {
  const { data, error } = await supabase
    .from("entity_assets")
    .select("display_size_pct, align")
    .eq("entity_id", entityId)
    .eq("role", "portrait")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return DEFAULT_PORTRAIT_LAYOUT;
  return { displaySizePct: data.display_size_pct, align: data.align as "left" | "right" };
}

/** N'affecte aucune ligne si aucun portrait n'a encore ete televerse (rien a mettre en page) — l'UI ne propose de toute facon ces reglages qu'une fois un portrait present. */
export async function updateEntityPortraitLayout(
  supabase: TypedClient,
  entityId: string,
  layout: EntityPortraitLayout
): Promise<void> {
  const { error } = await supabase
    .from("entity_assets")
    .update({ display_size_pct: layout.displaySizePct, align: layout.align })
    .eq("entity_id", entityId)
    .eq("role", "portrait");
  if (error) throw new Error(error.message);
}
