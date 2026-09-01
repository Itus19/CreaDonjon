import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { insertAsset, getAssetById, deleteAssetRow, type AssetRow } from "@/src/server/repos/assets";

type TypedClient = SupabaseClient<Database>;

/**
 * Interface de stockage de fichiers (ADR 0017, CLAUDE.md regle 16 bis :
 * "le stockage de fichiers passe par une interface, jamais par un appel
 * direct dans un composant"). Implementation Supabase Storage aujourd'hui,
 * remplacable par du disque local plus tard (cible locale,
 * specs/cible-locale-et-ia.md) sans toucher aux appelants — c'est tout
 * l'interet de ne jamais laisser `supabase.storage` fuiter hors de ce
 * fichier.
 *
 * Bucket prive, jamais public (migration 20260901150001) : une URL signee
 * de courte duree se genere ICI, apres avoir verifie que l'appelant a le
 * droit de voir CET asset precis (`getAssetById`, RLS `assets_select` deja
 * filtree par `app.visibility_permits`) — jamais en interrogeant
 * `storage.objects` directement, dont la porte est volontairement large
 * (juste "membre du monde", voir la migration).
 */
const BUCKET = "assets";
// 25 Mo (retour utilisateur : une carte reelle telechargee pese ~20 Mo) —
// releve depuis 10 Mo initial (ADR 0017). Seul appelant aujourd'hui : les
// cartes (Lot I) ; a revisiter si un futur appelant (ex. Phase F2, migration
// des portraits) a besoin d'une borne differente, jamais avant.
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
/** Assez court pour qu'une URL orpheline (copiee, partagee) expire vite ; assez long pour qu'une page qui charge plusieurs images n'en perde pas une en route. */
const SIGNED_URL_TTL_SECONDS = 300;

export type UploadAssetResult = { ok: true; asset: AssetRow } | { ok: false; reason: "too_large" | "unsupported_type" };

/**
 * Redimensionne (si `maxDimension` fourni) et televerse une image. Import
 * dynamique de `sharp` (meme motif que `entityPortraits.ts`) : son binaire
 * natif ne doit charger que pour un vrai televersement, jamais pour un
 * simple `getSignedAssetUrl`.
 */
export async function uploadAsset(
  supabase: TypedClient,
  params: {
    worldId: string;
    buffer: Buffer;
    mimeType: string;
    altText: string | null;
    visibilityLevel: string;
    visibilityScopeId: string | null;
    uploadedBy: string;
    maxDimension?: number;
  }
): Promise<UploadAssetResult> {
  if (params.buffer.byteLength > MAX_UPLOAD_BYTES) return { ok: false, reason: "too_large" };
  if (!ALLOWED_MIME_TYPES.has(params.mimeType)) return { ok: false, reason: "unsupported_type" };

  const { default: sharp } = await import("sharp");
  let processed = sharp(params.buffer);
  if (params.maxDimension) {
    processed = processed.resize(params.maxDimension, params.maxDimension, { fit: "inside", withoutEnlargement: true });
  }
  // `resolveWithObject: true` plutot que `metadata()` a part (bug corrige,
  // retour utilisateur : carte "completement pixelisee") : `sharp(...).metadata()`
  // lit les dimensions du fichier SOURCE, jamais celles apres un `resize()`
  // encore en attente dans le pipeline (resize n'est applique qu'au moment
  // ou l'image est reellement traitee) — `assets.width`/`height` stockaient
  // donc la resolution D'AVANT redimensionnement (ex. 5760px) alors que
  // l'image reellement enregistree ne faisait que 800 ou 4096px, ce qui
  // forçait le canevas a etirer l'image bien au-dela de sa vraie resolution.
  const { data: image, info } = await processed.webp({ quality: 85 }).toBuffer({ resolveWithObject: true });

  const id = crypto.randomUUID();
  const storagePath = `${params.worldId}/${id}.webp`;
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, image, {
    contentType: "image/webp",
    upsert: false,
  });
  if (uploadError) throw new Error(uploadError.message);

  const asset = await insertAsset(supabase, {
    id,
    worldId: params.worldId,
    storagePath,
    mimeType: "image/webp",
    byteSize: image.byteLength,
    width: info.width ?? null,
    height: info.height ?? null,
    altText: params.altText,
    visibilityLevel: params.visibilityLevel,
    visibilityScopeId: params.visibilityScopeId,
    uploadedBy: params.uploadedBy,
  });
  return { ok: true, asset };
}

/** `null` si l'asset n'existe pas OU si RLS le cache a cet appelant (`getAssetById`) — jamais distingue, meme convention que le reste de l'appli sur une ressource hors de portee. */
export async function getSignedAssetUrl(supabase: TypedClient, assetId: string): Promise<string | null> {
  const asset = await getAssetById(supabase, assetId);
  if (!asset) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(asset.storage_path, SIGNED_URL_TTL_SECONDS);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

/** `false` si l'asset n'existe pas ou est hors de portee (RLS `assets_delete`, deja `app.is_world_member`) — le fichier n'est retire du bucket qu'apres confirmation que la ligne a bien ete supprimee, jamais avant. */
export async function deleteAsset(supabase: TypedClient, assetId: string): Promise<boolean> {
  const asset = await getAssetById(supabase, assetId);
  if (!asset) return false;
  const deleted = await deleteAssetRow(supabase, assetId);
  if (!deleted) return false;
  const { error } = await supabase.storage.from(BUCKET).remove([asset.storage_path]);
  if (error) throw new Error(error.message);
  return true;
}
