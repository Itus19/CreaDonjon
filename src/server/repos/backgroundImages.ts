import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import type { ThemeMode } from "@/src/core/theme/oklch";

type TypedClient = SupabaseClient<Database>;

export interface BackgroundImageRow {
  id: string;
  owner_id: string;
  thumb_data_url: string;
  hue: number;
  chroma: number;
  available_modes: string[];
  created_at: string;
}

const COLUMNS = "id, owner_id, thumb_data_url, hue, chroma, available_modes, created_at";

export async function insertBackgroundImage(
  supabase: TypedClient,
  params: { ownerId: string; thumbDataUrl: string; assetId: string; hue: number; chroma: number; availableModes: ThemeMode[] }
): Promise<BackgroundImageRow> {
  const { data, error } = await supabase
    .from("background_images")
    .insert({
      owner_id: params.ownerId,
      thumb_data_url: params.thumbDataUrl,
      asset_id: params.assetId,
      hue: params.hue,
      chroma: params.chroma,
      available_modes: params.availableModes,
    })
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/** RLS (`background_images_select`) filtre deja par `owner_id = auth.uid()` — inutile de le repeter ici, avec un client scope a la requete (jamais `service_role`). */
export async function listBackgroundImagesForCurrentUser(supabase: TypedClient): Promise<BackgroundImageRow[]> {
  const { data, error } = await supabase.from("background_images").select(COLUMNS).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

/** `null` si absente OU si elle appartient a un autre compte (RLS) — les deux cas se traitent pareil cote appelant (repli sur le fond par defaut, jamais une erreur affichee). */
export async function getBackgroundImageById(supabase: TypedClient, id: string): Promise<BackgroundImageRow | null> {
  const { data, error } = await supabase.from("background_images").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Pointeur vers l'asset du backdrop plein format (V2-L1), jamais inclus
 * dans `COLUMNS` (`list`/`getById` ci-dessus) : ne sert qu'a la route qui
 * sert l'image (`GET /api/settings/background/[id]/image`). `null` si
 * absente ou appartenant a un autre compte (RLS) — meme convention que
 * `getBackgroundImageById`.
 */
export async function getBackgroundImageAssetId(supabase: TypedClient, id: string): Promise<string | null> {
  const { data, error } = await supabase.from("background_images").select("asset_id").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.asset_id ?? null;
}

/** `true` si une ligne a reellement ete supprimee — RLS renvoie sinon 0 ligne sans erreur (id inexistant ou appartenant a un autre compte), a distinguer d'un succes. */
export async function deleteBackgroundImage(supabase: TypedClient, id: string): Promise<boolean> {
  const { error, count } = await supabase.from("background_images").delete({ count: "exact" }).eq("id", id);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}
