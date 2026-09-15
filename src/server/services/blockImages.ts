import "server-only";
/**
 * V2.1-10 volet B : ce fichier ne porte plus que la LECTURE et la
 * suppression. Le televersement vit dans `blockImageUpload.ts` — il
 * atteignait `sharp` deux fois (couleur dominante, puis `uploadAsset`),
 * alors que `getBackgroundMetaForBlock` est importe par `publicShare.ts` et
 * `playerEntityDetail.ts`, donc par toute page de wiki.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import type { VisibilityLevel } from "@/src/core/visibility";
import { filterBlocks } from "@/src/core/visibility";

import {
  deleteBlockImage as deleteBlockImageRow,
  getBlockImageAssetId,
  getBlockImageBackgroundMeta,
  type BlockImageBackgroundMeta,
} from "@/src/server/repos/blockImages";
import { getBlockById } from "@/src/server/repos/blocks";
import { getEntityById } from "@/src/server/repos/entities";
import { buildViewerForWorld } from "@/src/server/services/visibility";
import { deleteAsset } from "@/src/server/services/storage";

type TypedClient = SupabaseClient<Database>;


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
