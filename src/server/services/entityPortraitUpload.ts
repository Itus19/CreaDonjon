import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { getEntityPortraitAssetId, setEntityPortraitAsset } from "@/src/server/repos/entityPortraits";
import { getEntityById } from "@/src/server/repos/entities";
import { deleteAsset } from "@/src/server/services/storage";
import { uploadAsset } from "@/src/server/services/assetUpload";

type TypedClient = SupabaseClient<Database>;

/**
 * V2.1-10 volet B — l'ECRITURE d'un portrait, separee de
 * `entityPortraits.ts` qui n'en garde que la lecture.
 *
 * Chaine que cette separation coupe : `publicShare.ts`,
 * `playerEntityDetail.ts` et `entityWindow.ts` importent tous
 * `getPortraitLayout` — c'est-a-dire que TOUTE page de wiki atteignait
 * `uploadAsset`, donc `sharp`, donc ses 78 Mo de binaires natifs recopies
 * dans la fonction deployee. Aucune de ces pages ne televerse quoi que ce
 * soit ; le traceur de Next ne le sait pas, il ne lit que les imports.
 *
 * Cette chaine n'etait pas dans l'analyse initiale du ticket, qui n'en
 * nommait que deux. Elle a ete trouvee en verifiant, avant de coder, que
 * traiter les deux nommees suffisait — ce n'etait pas le cas.
 */

// 5 Mo — meme borne qu'avant (background_images), plus stricte que le
// plafond generique de `storage.ts` (25 Mo, pense pour des cartes) : un
// portrait de fiche n'a aucune raison d'etre aussi lourd.
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
// Case portrait affichee a ~224px (w-56) : 640px couvre le retina sans
// garder un fichier disproportionne, pas besoin d'une miniature separee
// (pas de grille de selection ici, contrairement au fond d'ecran).
const PORTRAIT_MAX_DIMENSION = 640;

export type UploadEntityPortraitResult =
  | { ok: true }
  | { ok: false; reason: "too_large" | "unsupported_type" | "invalid_image" | "not_found" };

/**
 * Passe par l'interface de stockage commune (ADR 0017 decision 3) plutot
 * qu'un pipeline sharp separe — meme redimensionnement/encodage webp que les
 * cartes, juste une borne de taille et une dimension max differentes
 * (portrait : 5 Mo/640px, carte : 25 Mo/jusqu'a 4096px). Toujours
 * `visibility_level: "public"` : un portrait est public comme le nom de la
 * fiche, aucune notion de visibilite propre (contrairement a une carte) —
 * voir la migration `entity_assets_portrait` pour la garantie RLS
 * correspondante.
 */
export async function uploadEntityPortrait(
  supabase: TypedClient,
  params: { entityId: string; buffer: Buffer; mimeType: string; uploadedBy: string }
): Promise<UploadEntityPortraitResult> {
  if (params.buffer.byteLength > MAX_UPLOAD_BYTES) return { ok: false, reason: "too_large" };

  const entity = await getEntityById(supabase, params.entityId);
  if (!entity) return { ok: false, reason: "not_found" };

  const uploaded = await uploadAsset(supabase, {
    worldId: entity.world_id,
    buffer: params.buffer,
    mimeType: params.mimeType,
    altText: null,
    visibilityLevel: "public",
    visibilityScopeId: null,
    uploadedBy: params.uploadedBy,
    maxDimension: PORTRAIT_MAX_DIMENSION,
  });
  if (!uploaded.ok) return uploaded;

  // L'ancien asset (s'il existe) n'est retire qu'APRES que le nouveau
  // pointeur soit en place — jamais avant, pour ne jamais laisser la fiche
  // sans portrait entre les deux si une etape echoue en cours de route.
  const previousAssetId = await getEntityPortraitAssetId(supabase, params.entityId);
  await setEntityPortraitAsset(supabase, params.entityId, uploaded.asset.id);
  if (previousAssetId) await deleteAsset(supabase, previousAssetId);

  return { ok: true };
}
