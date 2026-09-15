import "server-only";
/**
 * V2.1-10 volet B : ce fichier ne porte plus que la LECTURE. Le
 * televersement vit dans `backgroundImageUpload.ts` — `app/layout.tsx`
 * importe `resolveBackgroundSelection` d'ici, donc les 47 pages
 * embarquaient le binaire de `sharp` par deux chemins a la fois.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";


import { BUILTIN_BACKGROUNDS } from "@/src/core/theme/builtinBackgrounds";
import {
  deleteBackgroundImage as deleteBackgroundImageRow,
  getBackgroundImageAssetId,
  getBackgroundImageById,
  listBackgroundImagesForCurrentUser,
  type BackgroundImageRow,
} from "@/src/server/repos/backgroundImages";
import { deleteAsset, getSignedAssetUrl } from "@/src/server/services/storage";

type TypedClient = SupabaseClient<Database>;

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
