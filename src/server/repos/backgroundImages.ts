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

/** PostgREST renvoie/attend un `bytea` en hexadecimal prefixe `\x` (`bytea_output = hex`, reglage par defaut de Postgres) — jamais du base64 ici, a la difference de `thumb_data_url` (une vraie data URL, pas un bytea). */
function bufferToBytea(buffer: Buffer): string {
  return `\\x${buffer.toString("hex")}`;
}
function byteaToBuffer(value: string): Buffer {
  return Buffer.from(value.replace(/^\\x/, ""), "hex");
}

export async function insertBackgroundImage(
  supabase: TypedClient,
  params: { ownerId: string; thumbDataUrl: string; backdropImage: Buffer; hue: number; chroma: number; availableModes: ThemeMode[] }
): Promise<BackgroundImageRow> {
  const { data, error } = await supabase
    .from("background_images")
    .insert({
      owner_id: params.ownerId,
      thumb_data_url: params.thumbDataUrl,
      backdrop_image: bufferToBytea(params.backdropImage),
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
 * Octets de l'image de fond, jamais inclus dans `COLUMNS` (`list`/`getById`
 * ci-dessus) : bien plus lourd que le reste de la ligne, ne sert qu'a la
 * route qui la sert (`GET /api/settings/background/[id]/image`). `null` si
 * absente ou appartenant a un autre compte (RLS) — meme convention que
 * `getBackgroundImageById`.
 */
export async function getBackgroundImageBinary(supabase: TypedClient, id: string): Promise<Buffer | null> {
  const { data, error } = await supabase.from("background_images").select("backdrop_image").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return byteaToBuffer(data.backdrop_image);
}

/** `true` si une ligne a reellement ete supprimee — RLS renvoie sinon 0 ligne sans erreur (id inexistant ou appartenant a un autre compte), a distinguer d'un succes. */
export async function deleteBackgroundImage(supabase: TypedClient, id: string): Promise<boolean> {
  const { error, count } = await supabase.from("background_images").delete({ count: "exact" }).eq("id", id);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}
