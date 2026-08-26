import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { processBackgroundImage } from "@/src/server/backgroundImageProcessing";
import { BUILTIN_BACKGROUNDS } from "@/src/core/theme/builtinBackgrounds";
import {
  deleteBackgroundImage as deleteBackgroundImageRow,
  getBackgroundImageBinary,
  getBackgroundImageById,
  insertBackgroundImage,
  listBackgroundImagesForCurrentUser,
  type BackgroundImageRow,
} from "@/src/server/repos/backgroundImages";

type TypedClient = SupabaseClient<Database>;

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 Mo — le plafond de 50 Mo de config.toml est un plafond de plateforme, pas une recommandation par image
const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export type UploadBackgroundImageResult =
  | { ok: true; image: BackgroundImageRow }
  | { ok: false; reason: "too_large" | "unsupported_type" };

export async function uploadBackgroundImage(
  supabase: TypedClient,
  params: { ownerId: string; buffer: Buffer; mimeType: string }
): Promise<UploadBackgroundImageResult> {
  if (params.buffer.byteLength > MAX_UPLOAD_BYTES) return { ok: false, reason: "too_large" };
  if (!ALLOWED_MIME_TYPES.has(params.mimeType)) return { ok: false, reason: "unsupported_type" };

  const processed = await processBackgroundImage(params.buffer);
  const image = await insertBackgroundImage(supabase, { ownerId: params.ownerId, ...processed });
  return { ok: true, image };
}

export async function listOwnBackgroundImages(supabase: TypedClient): Promise<BackgroundImageRow[]> {
  return listBackgroundImagesForCurrentUser(supabase);
}

/** `false` si l'image n'existe pas ou appartient a un autre compte (RLS) — refus explicite plutot qu'un succes silencieux. */
export async function deleteOwnBackgroundImage(supabase: TypedClient, id: string): Promise<boolean> {
  return deleteBackgroundImageRow(supabase, id);
}

export async function getBackgroundImageForOwner(supabase: TypedClient, id: string): Promise<BackgroundImageRow | null> {
  return getBackgroundImageById(supabase, id);
}

/** Octets de l'image de fond (jamais la miniature) — utilise uniquement par `GET /api/settings/background/[id]/image`. */
export async function getBackgroundImageBinaryForOwner(supabase: TypedClient, id: string): Promise<Buffer | null> {
  return getBackgroundImageBinary(supabase, id);
}

export interface ResolvedBackground {
  ref: string;
  /** URL a injecter dans `--bg-image` — jamais une data URL embarquee dans le HTML pour le fond lui-meme (contrairement a `thumb_data_url`, minuscule et fait pour ca) : un fichier statique pour une image fournie, la route de service pour un televersement personnel. */
  backdropUrl: string;
  hue: number;
  chroma: number;
  availableModes: string[];
}

/** `artwork-c` : c'etait deja le fond code en dur avant ce ticket (`app/layout.tsx`) — repli par defaut pour que personne ne voie son fond changer sans l'avoir choisi. `BUILTIN_BACKGROUNDS[0]` seulement si ce slug venait a disparaitre un jour. */
function defaultBuiltinBackground(): ResolvedBackground {
  const fallback = BUILTIN_BACKGROUNDS.find((b) => b.slug === "artwork-c") ?? BUILTIN_BACKGROUNDS[0];
  return { ref: `builtin:${fallback.slug}`, backdropUrl: fallback.backdropUrl, hue: fallback.hue, chroma: fallback.chroma, availableModes: fallback.availableModes };
}

/**
 * Resout le cookie `background` (`app/layout.tsx`) en ce qu'il faut
 * injecter dans le rendu — `builtin:<slug>` (aucun acces base, fond servi
 * directement depuis `public/backgrounds/`) ou l'id d'une ligne
 * `background_images` (verifiee appartenir au compte courant, RLS ; fond
 * servi par `GET /api/settings/background/[id]/image`). Un ref absent,
 * inconnu, ou appartenant a un autre compte retombe silencieusement sur
 * `artwork-c` — pas une erreur affichee pour un simple reglage d'apparence.
 */
export async function resolveBackgroundSelection(supabase: TypedClient, ref: string | undefined): Promise<ResolvedBackground> {
  if (!ref) return defaultBuiltinBackground();
  if (ref.startsWith("builtin:")) {
    const slug = ref.slice("builtin:".length);
    const builtin = BUILTIN_BACKGROUNDS.find((b) => b.slug === slug);
    if (!builtin) return defaultBuiltinBackground();
    return { ref, backdropUrl: builtin.backdropUrl, hue: builtin.hue, chroma: builtin.chroma, availableModes: builtin.availableModes };
  }
  const uploaded = await getBackgroundImageById(supabase, ref);
  if (!uploaded) return defaultBuiltinBackground();
  return { ref, backdropUrl: `/api/settings/background/${uploaded.id}/image`, hue: uploaded.hue, chroma: uploaded.chroma, availableModes: uploaded.available_modes };
}
