import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import type { VisibilityLevel } from "@/src/core/visibility";
import { filterBlocks } from "@/src/core/visibility";
import { availableModesFor, deriveHueChroma } from "@/src/core/theme/oklch";
import {
  deleteBlockImage as deleteBlockImageRow,
  getBlockImageAssetId,
  getBlockImageBackgroundMeta,
  upsertBlockImage,
  type BlockImageBackgroundMeta,
} from "@/src/server/repos/blockImages";
import { getBlockById } from "@/src/server/repos/blocks";
import { getEntityById } from "@/src/server/repos/entities";
import { buildViewerForWorld } from "@/src/server/services/visibility";
import { deleteAsset, uploadAsset } from "@/src/server/services/storage";

type TypedClient = SupabaseClient<Database>;

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 Mo — meme borne que le portrait/fond d'ecran
const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
// Plus genereux que le portrait (640px) : une image de bloc peut occuper
// toute la largeur de la colonne de prose (max-w-[70ch]), pas juste une
// case de cote.
const IMAGE_MAX_DIMENSION = 1600;

export type UploadBlockImageResult = { ok: true } | { ok: false; reason: "too_large" | "unsupported_type" | "not_found" };

/**
 * Passe par l'interface de stockage commune (V2-L1, meme motif que
 * `entityPortraits.ts`) — les octets vivent dans `assets`/Storage, jamais
 * plus en bytea. `visibilityLevel: "players"` uniforme sur l'asset lui-meme
 * (jamais synchronise avec la visibilite REELLE du bloc, qui peut etre `gm`
 * et changer apres coup) : la garde qui compte reste `filterBlocks` cote
 * service (`getImageForBlockAsUser`/`getPublicBlockImage`), exactement
 * comme avant ce ticket ou la RLS de `block_images` ne filtrait deja que
 * l'appartenance au monde, jamais la visibilite fine — "players" ici n'est
 * qu'un filet de securite au meme niveau de permissivite, pas une deuxieme
 * source de verite.
 */
export async function uploadBlockImage(
  supabase: TypedClient,
  params: { blockId: string; buffer: Buffer; mimeType: string; uploadedBy: string }
): Promise<UploadBlockImageResult> {
  if (params.buffer.byteLength > MAX_UPLOAD_BYTES) return { ok: false, reason: "too_large" };
  if (!ALLOWED_MIME_TYPES.has(params.mimeType)) return { ok: false, reason: "unsupported_type" };

  const block = await getBlockById(supabase, params.blockId);
  if (!block) return { ok: false, reason: "not_found" };
  const entity = await getEntityById(supabase, block.entity_id);
  if (!entity) return { ok: false, reason: "not_found" };

  // Import dynamique, calcul de teinte/chroma SEUL (V2-G13) : `uploadAsset`
  // fait deja son propre redimensionnement/encodage pour le stockage, cette
  // passe-ci ne sert qu'a `stats()` (couleur dominante), jamais reutilisee
  // pour les octets stockes — meme redondance mineure acceptee que pour
  // `background_images` (voir son commentaire), le pipeline de stockage
  // reste generique et ignore tout ce qui est theme/couleur.
  const { default: sharp } = await import("sharp");
  const stats = await sharp(params.buffer)
    .resize(IMAGE_MAX_DIMENSION, IMAGE_MAX_DIMENSION, { fit: "inside", withoutEnlargement: true })
    .stats();
  const { hue, chroma } = deriveHueChroma(stats.dominant);

  const uploaded = await uploadAsset(supabase, {
    worldId: entity.world_id,
    buffer: params.buffer,
    mimeType: params.mimeType,
    altText: null,
    visibilityLevel: "players",
    visibilityScopeId: null,
    uploadedBy: params.uploadedBy,
    maxDimension: IMAGE_MAX_DIMENSION,
  });
  if (!uploaded.ok) return uploaded;

  // L'ancien asset (s'il existe) n'est retire qu'APRES que le nouveau
  // pointeur soit en place — meme ordre que entityPortraits.ts.
  const previousAssetId = await getBlockImageAssetId(supabase, params.blockId);
  await upsertBlockImage(supabase, {
    blockId: params.blockId,
    assetId: uploaded.asset.id,
    hue,
    chroma,
    availableModes: availableModesFor(hue, chroma),
  });
  if (previousAssetId) await deleteAsset(supabase, previousAssetId);

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
export async function getImageAssetIdForBlockAsUser(
  supabase: TypedClient,
  blockId: string,
  userId: string
): Promise<string | null> {
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

  return getBlockImageAssetId(supabase, blockId);
}

/** Retire le pointeur ET l'asset lui-meme (V2-L1) — jamais un orphelin dans le bucket. */
export async function removeBlockImage(supabase: TypedClient, blockId: string): Promise<void> {
  const assetId = await getBlockImageAssetId(supabase, blockId);
  await deleteBlockImageRow(supabase, blockId);
  if (assetId) await deleteAsset(supabase, assetId);
}

export async function getBackgroundMetaForBlock(
  supabase: TypedClient,
  blockId: string
): Promise<BlockImageBackgroundMeta | null> {
  return getBlockImageBackgroundMeta(supabase, blockId);
}
