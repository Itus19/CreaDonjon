import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { insertAsset, type AssetRow } from "@/src/server/repos/assets";
import { ASSETS_BUCKET, MAX_UPLOAD_BYTES } from "@/src/server/services/storage";

type TypedClient = SupabaseClient<Database>;

/**
 * V2.1-10 volet B — l'ECRITURE d'un asset, separee de `storage.ts` qui n'en
 * porte plus que la lecture.
 *
 * Ce n'est pas une abstraction, c'est une separation, et elle a une cause
 * mesuree : le traceur de fichiers de Next travaille sur le graphe
 * d'IMPORTS, jamais sur les chemins d'execution. Il suffisait qu'un module
 * du graphe mentionne `sharp` pour que ses 78 Mo de binaires natifs soient
 * recopies dans la fonction deployee — meme si la branche qui les appelle
 * n'etait jamais atteinte. `storage.ts` melangeait `uploadAsset` (sharp) et
 * `deleteAsset`/`getSignedAssetUrl` (rien du tout) : lire une image
 * obligeait donc a embarquer le pipeline de traitement.
 *
 * Regle qui en decoule, et qui vaut pour les trois autres fichiers separes
 * au meme ticket : **un fichier qui touche `sharp` ne doit rien exporter
 * qu'un chemin de lecture ait besoin d'importer.**
 *
 * `ALLOWED_MIME_TYPES` vit ici et non dans `storage.ts` : c'est une garde
 * d'ecriture, aucun lecteur n'en a l'usage.
 */
const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export type UploadAssetResult = { ok: true; asset: AssetRow } | { ok: false; reason: "too_large" | "unsupported_type" | "invalid_image" };

/**
 * Redimensionne (si `maxDimension` fourni) et televerse une image. Import
 * dynamique de `sharp` : son binaire natif ne doit charger que pour un vrai
 * televersement — c'est vrai a l'execution depuis toujours, et c'est
 * desormais vrai aussi au TRACAGE, ce fichier n'etant atteint que par les
 * quatre routes qui televersent.
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

  // Le type MIME vient de ce que le NAVIGATEUR declare (`file.type`),
  // jamais du contenu reel : un fichier quelconque renomme en .png passe
  // le controle ci-dessus, puis fait echouer sharp. Sans ce try, cette
  // exception remonte a travers la route et devient un 500 — la personne
  // lit "une erreur est survenue" la ou elle devrait lire "ce fichier
  // n'est pas une image" (audit B-11). Aucun risque de securite : sharp ne
  // se detourne pas avec un fichier arbitraire, et tout est de toute facon
  // reencode en webp. C'est un probleme de qualite percue, pas de surete.
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
  let image: Buffer;
  let info: { width?: number; height?: number };
  try {
    ({ data: image, info } = await processed.webp({ quality: 85 }).toBuffer({ resolveWithObject: true }));
  } catch {
    return { ok: false, reason: "invalid_image" };
  }

  const id = crypto.randomUUID();
  const storagePath = `${params.worldId}/${id}.webp`;
  const { error: uploadError } = await supabase.storage.from(ASSETS_BUCKET).upload(storagePath, image, {
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
