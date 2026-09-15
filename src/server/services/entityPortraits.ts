import "server-only";
/**
 * V2.1-10 volet B : ce fichier ne porte plus que la LECTURE et la
 * suppression. Le televersement vit dans `entityPortraitUpload.ts` — il
 * atteignait `sharp` par `uploadAsset`, et comme `getPortraitLayout` est
 * importe par `publicShare.ts`, `playerEntityDetail.ts` et
 * `entityWindow.ts`, toute page de wiki embarquait le binaire natif pour
 * rien.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import {
  getEntityPortraitAssetId,
  getEntityPortraitLayout,
  removeEntityPortraitAsset,
  updateEntityPortraitLayout,
  type EntityPortraitLayout,
} from "@/src/server/repos/entityPortraits";

import { deleteAsset } from "@/src/server/services/storage";

type TypedClient = SupabaseClient<Database>;

export async function getPortraitAssetId(supabase: TypedClient, entityId: string): Promise<string | null> {
  return getEntityPortraitAssetId(supabase, entityId);
}

/** `false` si la fiche n'a pas de portrait ou est hors de portee (RLS) — refus explicite plutot qu'un succes silencieux. */
export async function removeEntityPortrait(supabase: TypedClient, entityId: string): Promise<boolean> {
  const assetId = await removeEntityPortraitAsset(supabase, entityId);
  if (!assetId) return false;
  await deleteAsset(supabase, assetId);
  return true;
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
