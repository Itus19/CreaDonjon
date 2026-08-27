import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";
import type { Database } from "@/src/types/database";
import type { VisibilityLevel } from "@/src/core/visibility";
import { filterBlocks } from "@/src/core/visibility";
import {
  deleteBlockImage as deleteBlockImageRow,
  getBlockImage,
  upsertBlockImage,
  type BlockImage,
} from "@/src/server/repos/blockImages";
import { getBlockById } from "@/src/server/repos/blocks";
import { getEntityById } from "@/src/server/repos/entities";
import { buildViewerForWorld } from "@/src/server/services/visibility";

type TypedClient = SupabaseClient<Database>;

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 Mo — meme borne que le portrait/fond d'ecran
const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
// Plus genereux que le portrait (640px) : une image de bloc peut occuper
// toute la largeur de la colonne de prose (max-w-[70ch]), pas juste une
// case de cote.
const IMAGE_MAX_DIMENSION = 1600;

export type UploadBlockImageResult = { ok: true } | { ok: false; reason: "too_large" | "unsupported_type" };

export async function uploadBlockImage(
  supabase: TypedClient,
  params: { blockId: string; buffer: Buffer; mimeType: string }
): Promise<UploadBlockImageResult> {
  if (params.buffer.byteLength > MAX_UPLOAD_BYTES) return { ok: false, reason: "too_large" };
  if (!ALLOWED_MIME_TYPES.has(params.mimeType)) return { ok: false, reason: "unsupported_type" };

  const processed = sharp(params.buffer).resize(IMAGE_MAX_DIMENSION, IMAGE_MAX_DIMENSION, {
    fit: "inside",
    withoutEnlargement: true,
  });
  const [image, metadata] = await Promise.all([
    processed.clone().webp({ quality: 82 }).toBuffer(),
    processed.clone().metadata(),
  ]);

  await upsertBlockImage(supabase, {
    blockId: params.blockId,
    image,
    mimeType: "image/webp",
    width: metadata.width ?? IMAGE_MAX_DIMENSION,
    height: metadata.height ?? IMAGE_MAX_DIMENSION,
  });
  return { ok: true };
}

/**
 * Cote editeur/apercu authentifie : la RLS (block_images_select) ne
 * restreint qu'a l'appartenance au monde (SCHEMA.md, Phase 0) — la
 * visibilite fine du bloc (peut etre `gm`) doit encore etre reappliquee
 * ici, meme `filterBlocks` que `listVisibleBlocks`
 * (src/server/services/blocks.ts), pour qu'un joueur non-MJ ne puisse pas
 * recuperer par l'URL une image qu'il ne voit pas dans la fiche elle-meme.
 */
export async function getImageForBlockAsUser(
  supabase: TypedClient,
  blockId: string,
  userId: string
): Promise<BlockImage | null> {
  const block = await getBlockById(supabase, blockId);
  if (!block) return null;
  const entity = await getEntityById(supabase, block.entity_id);
  if (!entity) return null;

  const viewer = await buildViewerForWorld(supabase, entity.world_id, userId);
  const visible = filterBlocks(
    [
      {
        ...block,
        visibility: {
          level: block.visibility_level as VisibilityLevel,
          scopeId: block.visibility_scope_id,
          createdBy: block.created_by,
        },
      },
    ],
    viewer
  );
  if (visible.length === 0) return null;

  return getBlockImage(supabase, blockId);
}

export async function removeBlockImage(supabase: TypedClient, blockId: string): Promise<void> {
  return deleteBlockImageRow(supabase, blockId);
}
