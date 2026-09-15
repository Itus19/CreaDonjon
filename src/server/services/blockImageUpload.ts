import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { availableModesFor, deriveHueChroma } from "@/src/core/theme/oklch";
import { getBlockImageAssetId, upsertBlockImage } from "@/src/server/repos/blockImages";
import { getBlockById } from "@/src/server/repos/blocks";
import { getEntityById } from "@/src/server/repos/entities";
import { deleteAsset } from "@/src/server/services/storage";
import { uploadAsset } from "@/src/server/services/assetUpload";

type TypedClient = SupabaseClient<Database>;

/**
 * V2.1-10 volet B — l'ECRITURE d'une image de bloc, separee de
 * `blockImages.ts` qui n'en garde que la lecture.
 *
 * Ce fichier porte DEUX chemins vers `sharp` : son propre
 * `import("sharp")` (calcul de la couleur dominante) et celui de
 * `uploadAsset`. Cote lecture, `getBackgroundMetaForBlock` est importe par
 * `publicShare.ts` et `playerEntityDetail.ts` — donc toute page de wiki
 * tirait les deux. Deuxieme chaine absente de l'analyse initiale du ticket.
 */

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 Mo — meme borne que le portrait/fond d'ecran
const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
// Plus genereux que le portrait (640px) : une image de bloc peut occuper
// toute la largeur de la colonne de prose (max-w-[70ch]), pas juste une
// case de cote.
const IMAGE_MAX_DIMENSION = 1600;

export type UploadBlockImageResult = { ok: true } | { ok: false; reason: "too_large" | "unsupported_type" | "invalid_image" | "not_found" };

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
  // Ce sharp-ci s'execute AVANT `uploadAsset` : sa propre garde
  // `invalid_image` ne servirait a rien si un fichier illisible faisait
  // deja echouer le calcul de couleur dominante ici (audit B-11).
  const { default: sharp } = await import("sharp");
  let hue: number;
  let chroma: number;
  try {
    const stats = await sharp(params.buffer)
      .resize(IMAGE_MAX_DIMENSION, IMAGE_MAX_DIMENSION, { fit: "inside", withoutEnlargement: true })
      .stats();
    ({ hue, chroma } = deriveHueChroma(stats.dominant));
  } catch {
    return { ok: false, reason: "invalid_image" };
  }

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
