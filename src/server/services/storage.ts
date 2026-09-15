import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { getAssetById, deleteAssetRow } from "@/src/server/repos/assets";

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
/** Expose pour `assetUpload.ts` (V2.1-10 volet B) : l'ecriture vit desormais dans son propre fichier, mais le nom du bucket reste defini ICI — `supabase.storage` ne doit jamais fuiter hors de l'interface de stockage (ADR 0017). */
export const ASSETS_BUCKET = "assets";
const BUCKET = ASSETS_BUCKET;
// 25 Mo (retour utilisateur : une carte reelle telechargee pese ~20 Mo) —
// releve depuis 10 Mo initial (ADR 0017). Seul appelant aujourd'hui : les
// cartes (Lot I) ; a revisiter si un futur appelant (ex. Phase F2, migration
// des portraits) a besoin d'une borne differente, jamais avant.
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
/** Assez court pour qu'une URL orpheline (copiee, partagee) expire vite ; assez long pour qu'une page qui charge plusieurs images n'en perde pas une en route. */
const SIGNED_URL_TTL_SECONDS = 300;

/**
 * Duree de mise en cache de la REDIRECTION vers une URL signee (audit
 * P-03). Une 307 sans `Cache-Control` n'est pas conservee par le
 * navigateur : les trois allers-retours qui la precedent (authentification
 * dans le middleware, lecture de la ligne `assets`, signature Storage)
 * etaient donc refaits a CHAQUE affichage de CHAQUE image, y compris au
 * simple retour sur une fiche deja vue.
 *
 * Volontairement inferieure a `SIGNED_URL_TTL_SECONDS` : le navigateur ne
 * doit jamais reutiliser une redirection vers une URL deja expiree. La
 * marge de 60 s couvre le temps entre la reception de la reponse et son
 * usage reel.
 *
 * `private` : un cache partage (proxy, CDN) ne doit jamais conserver
 * cette reponse — elle est le resultat d'une verification de droits faite
 * pour UN visiteur precis.
 */
export const SIGNED_URL_CACHE_SECONDS = SIGNED_URL_TTL_SECONDS - 60;
export const SIGNED_URL_CACHE_HEADER = `private, max-age=${SIGNED_URL_CACHE_SECONDS}`;

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
