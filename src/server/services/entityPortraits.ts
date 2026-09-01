import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import {
  deleteEntityPortrait as deleteEntityPortraitRow,
  getEntityPortrait,
  getEntityPortraitLayout,
  updateEntityPortraitLayout,
  upsertEntityPortrait,
  type EntityPortrait,
  type EntityPortraitLayout,
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

  // Import dynamique : `sharp` charge un binaire natif (libvips) au demarrage.
  // Un import statique en tete de fichier le chargerait pour tout consommateur
  // de ce module — y compris `getPortraitLayout`, appelee a chaque rendu de
  // fiche — alors que seul ce televersement en a besoin.
  const { default: sharp } = await import("sharp");
  const processed = sharp(params.buffer).resize(PORTRAIT_MAX_DIMENSION, PORTRAIT_MAX_DIMENSION, {
    fit: "inside",
    withoutEnlargement: true,
  });
  // `resolveWithObject: true` plutot que `metadata()` a part (meme bug que
  // storage.ts, retour utilisateur) : `metadata()` lit les dimensions du
  // fichier SOURCE, jamais celles apres le `resize()` encore en attente.
  const { data: image, info } = await processed.webp({ quality: 82 }).toBuffer({ resolveWithObject: true });

  await upsertEntityPortrait(supabase, {
    entityId: params.entityId,
    image,
    mimeType: "image/webp",
    width: info.width ?? PORTRAIT_MAX_DIMENSION,
    height: info.height ?? PORTRAIT_MAX_DIMENSION,
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

export async function getPortraitLayout(supabase: TypedClient, entityId: string): Promise<EntityPortraitLayout> {
  return getEntityPortraitLayout(supabase, entityId);
}

export async function setPortraitLayout(
  supabase: TypedClient,
  entityId: string,
  layout: EntityPortraitLayout
): Promise<void> {
  return updateEntityPortraitLayout(supabase, entityId, layout);
}
