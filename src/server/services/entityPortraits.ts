import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";
import type { Database } from "@/src/types/database";
import {
  deleteEntityPortrait as deleteEntityPortraitRow,
  getEntityPortrait,
  upsertEntityPortrait,
  type EntityPortrait,
} from "@/src/server/repos/entityPortraits";

type TypedClient = SupabaseClient<Database>;

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 Mo — meme borne que background_images
const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
// Case portrait affichee a ~224px (w-56) : 640px couvre le retina sans
// garder un fichier disproportionne, pas besoin d'une miniature separee
// (pas de grille de selection ici, contrairement au fond d'ecran).
const PORTRAIT_MAX_DIMENSION = 640;

export type UploadEntityPortraitResult =
  | { ok: true }
  | { ok: false; reason: "too_large" | "unsupported_type" };

export async function uploadEntityPortrait(
  supabase: TypedClient,
  params: { entityId: string; buffer: Buffer; mimeType: string }
): Promise<UploadEntityPortraitResult> {
  if (params.buffer.byteLength > MAX_UPLOAD_BYTES) return { ok: false, reason: "too_large" };
  if (!ALLOWED_MIME_TYPES.has(params.mimeType)) return { ok: false, reason: "unsupported_type" };

  const processed = sharp(params.buffer).resize(PORTRAIT_MAX_DIMENSION, PORTRAIT_MAX_DIMENSION, {
    fit: "inside",
    withoutEnlargement: true,
  });
  const [image, metadata] = await Promise.all([
    processed.clone().webp({ quality: 82 }).toBuffer(),
    processed.clone().metadata(),
  ]);

  await upsertEntityPortrait(supabase, {
    entityId: params.entityId,
    image,
    mimeType: "image/webp",
    width: metadata.width ?? PORTRAIT_MAX_DIMENSION,
    height: metadata.height ?? PORTRAIT_MAX_DIMENSION,
  });
  return { ok: true };
}

export async function getPortraitForEntity(supabase: TypedClient, entityId: string): Promise<EntityPortrait | null> {
  return getEntityPortrait(supabase, entityId);
}

/** `false` si la fiche n'a pas de portrait ou est hors de portee (RLS) — refus explicite plutot qu'un succes silencieux. */
export async function removeEntityPortrait(supabase: TypedClient, entityId: string): Promise<boolean> {
  return deleteEntityPortraitRow(supabase, entityId);
}
