import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { getAnyWorldIdForUser } from "@/src/server/repos/worlds";
import { processBackgroundImage } from "@/src/server/backgroundImageProcessing";
import { BUILTIN_BACKGROUNDS } from "@/src/core/theme/builtinBackgrounds";
import {
  deleteBackgroundImage as deleteBackgroundImageRow,
  getBackgroundImageAssetId,
  getBackgroundImageById,
  insertBackgroundImage,
  listBackgroundImagesForCurrentUser,
  type BackgroundImageRow,
} from "@/src/server/repos/backgroundImages";
import { deleteAsset, getSignedAssetUrl, uploadAsset } from "@/src/server/services/storage";

type TypedClient = SupabaseClient<Database>;

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 Mo — le plafond de 50 Mo de config.toml est un plafond de plateforme, pas une recommandation par image
const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const BACKDROP_MAX_DIMENSION = 1920; // meme borne que l'ancien pipeline (backgroundImageProcessing.ts)

export type UploadBackgroundImageResult =
  | { ok: true; image: BackgroundImageRow }
  | { ok: false; reason: "too_large" | "unsupported_type" };

export type UploadBackgroundImageErrorResult = { ok: false; reason: "too_large" | "unsupported_type" | "no_world" };

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
  const processed = await processBackgroundImage(params.buffer);
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

export async function listOwnBackgroundImages(supabase: TypedClient): Promise<BackgroundImageRow[]> {
  return listBackgroundImagesForCurrentUser(supabase);
}

/** `false` si l'image n'existe pas ou appartient a un autre compte (RLS) — refus explicite plutot qu'un succes silencieux. Retire aussi l'asset (V2-L1), jamais un orphelin dans le bucket. */
export async function deleteOwnBackgroundImage(supabase: TypedClient, id: string): Promise<boolean> {
  const assetId = await getBackgroundImageAssetId(supabase, id);
  const deleted = await deleteBackgroundImageRow(supabase, id);
  if (deleted && assetId) await deleteAsset(supabase, assetId);
  return deleted;
}

export async function getBackgroundImageForOwner(supabase: TypedClient, id: string): Promise<BackgroundImageRow | null> {
  return getBackgroundImageById(supabase, id);
}

/**
 * Octets du backdrop plein format (V2-L1), utilise uniquement par
 * `GET /api/settings/background/[id]/image` — celle-ci reste un flux direct
 * (jamais une redirection vers l'URL signee, contrairement au portrait/aux
 * images de bloc) : un fond de page se recharge a CHAQUE navigation
 * (`app/layout.tsx`), une redirection vers une URL signee de 5 minutes
 * casserait le cache navigateur `immutable` d'un an que cette route pose
 * deja — l'aller-retour Storage a donc lieu ICI, cote serveur, une seule
 * fois par acces, jamais a chaque chargement de page cote client.
 */
export async function getBackgroundImageBinaryForOwner(supabase: TypedClient, id: string): Promise<Buffer | null> {
  const assetId = await getBackgroundImageAssetId(supabase, id);
  if (!assetId) return null;
  const url = await getSignedAssetUrl(supabase, assetId);
  if (!url) return null;
  const res = await fetch(url);
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

export interface ResolvedBackground {
  ref: string;
  /** URL a injecter dans `--bg-image` — jamais une data URL embarquee dans le HTML pour le fond lui-meme (contrairement a `thumb_data_url`, minuscule et fait pour ca) : un fichier statique pour une image fournie, la route de service pour un televersement personnel. */
  backdropUrl: string;
  hue: number;
  chroma: number;
  availableModes: string[];
}

/** `artwork-c` : c'etait deja le fond code en dur avant ce ticket (`app/layout.tsx`) — repli par defaut pour que personne ne voie son fond changer sans l'avoir choisi. `BUILTIN_BACKGROUNDS[0]` seulement si ce slug venait a disparaitre un jour. */
function defaultBuiltinBackground(): ResolvedBackground {
  const fallback = BUILTIN_BACKGROUNDS.find((b) => b.slug === "artwork-c") ?? BUILTIN_BACKGROUNDS[0];
  return { ref: `builtin:${fallback.slug}`, backdropUrl: fallback.backdropUrl, hue: fallback.hue, chroma: fallback.chroma, availableModes: fallback.availableModes };
}

/**
 * Resout le cookie `background` (`app/layout.tsx`) en ce qu'il faut
 * injecter dans le rendu — `builtin:<slug>` (aucun acces base, fond servi
 * directement depuis `public/backgrounds/`) ou l'id d'une ligne
 * `background_images` (verifiee appartenir au compte courant, RLS ; fond
 * servi par `GET /api/settings/background/[id]/image`). Un ref absent,
 * inconnu, ou appartenant a un autre compte retombe silencieusement sur
 * `artwork-c` — pas une erreur affichee pour un simple reglage d'apparence.
 */
export async function resolveBackgroundSelection(supabase: TypedClient, ref: string | undefined): Promise<ResolvedBackground> {
  if (!ref) return defaultBuiltinBackground();
  if (ref.startsWith("builtin:")) {
    const slug = ref.slice("builtin:".length);
    const builtin = BUILTIN_BACKGROUNDS.find((b) => b.slug === slug);
    if (!builtin) return defaultBuiltinBackground();
    return { ref, backdropUrl: builtin.backdropUrl, hue: builtin.hue, chroma: builtin.chroma, availableModes: builtin.availableModes };
  }
  const uploaded = await getBackgroundImageById(supabase, ref);
  if (!uploaded) return defaultBuiltinBackground();
  return { ref, backdropUrl: `/api/settings/background/${uploaded.id}/image`, hue: uploaded.hue, chroma: uploaded.chroma, availableModes: uploaded.available_modes };
}
