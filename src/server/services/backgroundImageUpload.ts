import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { getAnyWorldIdForUser } from "@/src/server/repos/worlds";
import { processBackgroundImage } from "@/src/server/backgroundImageProcessing";
import { insertBackgroundImage, type BackgroundImageRow } from "@/src/server/repos/backgroundImages";
import { uploadAsset } from "@/src/server/services/assetUpload";

type TypedClient = SupabaseClient<Database>;

/**
 * V2.1-10 volet B — l'ECRITURE d'un fond d'ecran personnel, separee de
 * `backgroundImages.ts` qui n'en garde que la lecture.
 *
 * C'est la chaine la plus couteuse des quatre : `app/layout.tsx` — le layout
 * RACINE — importe `resolveBackgroundSelection`, qui vivait dans le meme
 * fichier que ce televersement. Les 47 pages de l'application embarquaient
 * donc le binaire de `sharp`, par deux chemins a la fois
 * (`processBackgroundImage` et `uploadAsset`).
 */

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 Mo — le plafond de 50 Mo de config.toml est un plafond de plateforme, pas une recommandation par image
const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const BACKDROP_MAX_DIMENSION = 1920; // meme borne que l'ancien pipeline (backgroundImageProcessing.ts)

export type UploadBackgroundImageResult =
  | { ok: true; image: BackgroundImageRow }
  | { ok: false; reason: "too_large" | "unsupported_type" | "invalid_image" };

export type UploadBackgroundImageErrorResult = { ok: false; reason: "too_large" | "unsupported_type" | "invalid_image" | "no_world" };

/**
 * Le fond d'ecran n'appartient a aucun monde (reglage personnel du compte,
 * `owner_id`) — `uploadAsset` exige pourtant un `worldId` (les assets de
 * carte/bloc en dependent pour leur chemin de stockage). Un pseudo-monde
 * n'existant pas serait pire qu'un choix explicite : `getAnyWorldIdForUser`
 * (n'importe quel monde accessible a ce compte) sert de regroupement de
 * stockage, sans consequence sur la visibilite reelle de l'asset —
 * `visibilityLevel: "user"` scope a `ownerId` est la SEULE garde qui compte
 * ici, independamment du monde choisi pour le chemin.
 */
export async function uploadBackgroundImage(
  supabase: TypedClient,
  params: { ownerId: string; buffer: Buffer; mimeType: string }
): Promise<UploadBackgroundImageResult | UploadBackgroundImageErrorResult> {
  if (params.buffer.byteLength > MAX_UPLOAD_BYTES) return { ok: false, reason: "too_large" };
  if (!ALLOWED_MIME_TYPES.has(params.mimeType)) return { ok: false, reason: "unsupported_type" };

  const worldId = await getAnyWorldIdForUser(supabase, params.ownerId);
  if (!worldId) return { ok: false, reason: "no_world" };

  // `processBackgroundImage` ne calcule plus que la miniature carree
  // (fit:cover, jamais produite par `uploadAsset`, generique et "fit:inside"
  // seulement) et la teinte/chroma — le backdrop plein format est televerse
  // separement via l'interface de stockage commune, meme redondance mineure
  // acceptee que pour `blockImages.ts`.
  // Meme motif que `blockImages` : ce traitement precede `uploadAsset`, sa
  // garde ne peut donc pas etre deleguee (audit B-11).
  let processed;
  try {
    processed = await processBackgroundImage(params.buffer);
  } catch {
    return { ok: false, reason: "invalid_image" };
  }
  const uploaded = await uploadAsset(supabase, {
    worldId,
    buffer: params.buffer,
    mimeType: params.mimeType,
    altText: null,
    visibilityLevel: "user",
    visibilityScopeId: params.ownerId,
    uploadedBy: params.ownerId,
    maxDimension: BACKDROP_MAX_DIMENSION,
  });
  if (!uploaded.ok) return uploaded;

  const image = await insertBackgroundImage(supabase, {
    ownerId: params.ownerId,
    thumbDataUrl: processed.thumbDataUrl,
    assetId: uploaded.asset.id,
    hue: processed.hue,
    chroma: processed.chroma,
    availableModes: processed.availableModes,
  });
  return { ok: true, image };
}

