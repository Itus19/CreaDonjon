import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { countAssetReferences, getAssetById, deleteAssetRow, insertAsset } from "@/src/server/repos/assets";

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

/**
 * V3.1-128 (docs/QUOTAS.md Q5) — efface une image que plus rien ne designe.
 * A appeler APRES l'ecriture qui l'a abandonnee : le compte voit alors
 * l'etat final. Une image encore designee ailleurs (fiche ou bloc
 * duplique), ou dont le compte est inconnu, est gardee.
 *
 * Geste « au mieux » : un echec est journalise et n'annule pas l'ecriture
 * qui vient de reussir ; au pire, un orphelin reste dans le stockage.
 */
export async function deleteAssetIfUnreferenced(supabase: TypedClient, assetId: string): Promise<boolean> {
  try {
    const references = await countAssetReferences(supabase, assetId);
    if (references !== 0) return false;
    return await deleteAsset(supabase, assetId);
  } catch (erreur) {
    console.error(`Image ${assetId} non effacee (orpheline possible dans le stockage)`, erreur);
    return false;
  }
}

/**
 * `false` si l'asset n'existe pas ou est hors de portee (RLS `assets_select`
 * puis `assets_delete`, `app.is_world_member`).
 *
 * Le FICHIER d'abord, la ligne ensuite (V3.1-128, corrige le 12 octobre).
 * La regle de lecture du stockage (`assets_bucket_select`, migration
 * 20260902110001) n'ouvre un fichier que si une ligne `assets` le designe ;
 * et `remove` ne retire que ce qu'il peut lire. Dans l'ordre inverse, la
 * ligne effacee rendait le fichier invisible : `remove` ne retirait rien,
 * sans erreur, et chaque image supprimee depuis le 2 septembre restait dans
 * le stockage. Lire la ligne (`getAssetById`) donne le meme droit de lecture
 * que le fichier : un appelant qui arrive ici peut le retirer.
 */
export async function deleteAsset(supabase: TypedClient, assetId: string): Promise<boolean> {
  const asset = await getAssetById(supabase, assetId);
  if (!asset) return false;
  const { data: retires, error } = await supabase.storage.from(BUCKET).remove([asset.storage_path]);
  if (error) throw new Error(error.message);
  // Fichier deja absent (envoi interrompu, ancien nettoyage) : la ligne part
  // quand meme, elle ne designe plus rien. Signale, jamais muet.
  if (retires.length === 0) console.error(`Fichier ${asset.storage_path} absent ou non retire du stockage ; la ligne assets ${assetId} est effacee quand meme`);
  return deleteAssetRow(supabase, assetId);
}

/**
 * V3-F3 (ADR 0058) — copie une image dans un autre monde : un fichier neuf
 * (`<monde>/<id>.<ext>`) et sa ligne `assets`, jamais un partage. Un joueur
 * du monde neuf n'est pas membre de l'ancien : il ne verrait pas une image
 * restee la-bas. Une portee `campaign`/`user` ne survit pas au changement de
 * monde (ses identifiants n'y existent pas) : elle retombe sur `gm`, comme a
 * l'export. Le fichier d'abord, la ligne ensuite : un echec entre les deux
 * laisse au pire un fichier sans ligne, que le recensement retrouve.
 */
export async function copyAssetToWorld(
  supabase: TypedClient,
  asset: {
    storage_path: string;
    mime_type: string;
    byte_size: number;
    width: number | null;
    height: number | null;
    alt_text: string | null;
    visibility_level: string;
  },
  params: { worldId: string; uploadedBy: string }
): Promise<string> {
  const id = crypto.randomUUID();
  const extension = asset.storage_path.includes(".") ? asset.storage_path.slice(asset.storage_path.lastIndexOf(".")) : "";
  const storagePath = `${params.worldId}/${id}${extension}`;
  const { error } = await supabase.storage.from(BUCKET).copy(asset.storage_path, storagePath);
  if (error) throw new Error(`Image ${asset.storage_path} non copiee : ${error.message}`);
  const visibilityLevel = asset.visibility_level === "campaign" || asset.visibility_level === "user" ? "gm" : asset.visibility_level;
  await insertAsset(supabase, {
    id,
    worldId: params.worldId,
    storagePath,
    mimeType: asset.mime_type,
    byteSize: asset.byte_size,
    width: asset.width,
    height: asset.height,
    altText: asset.alt_text,
    visibilityLevel,
    visibilityScopeId: null,
    uploadedBy: params.uploadedBy,
  });
  return id;
}

/**
 * V3.1-84 (ADR 0061) — le logo téléversé de l'application. Bucket à part,
 * `brand`, car il n'appartient à aucun monde : les règles du bucket `assets`
 * (dossier = monde) ne s'y appliquent pas. Lecture ouverte à tous (l'écran-
 * titre le montre avant connexion), écriture au superadmin (migration
 * 20261013120000). Toujours un WebP, réencodé par le serveur avant l'écriture.
 */
const BRAND_BUCKET = "brand";

export async function putBrandLogo(supabase: TypedClient, path: string, webp: Buffer): Promise<void> {
  const { error } = await supabase.storage.from(BRAND_BUCKET).upload(path, webp, { contentType: "image/webp", upsert: false });
  if (error) throw new Error(`logo : ${error.message}`);
}

/** Les octets du logo, ou `null` s'il n'existe plus. */
export async function readBrandLogo(supabase: TypedClient, path: string): Promise<Buffer | null> {
  const { data, error } = await supabase.storage.from(BRAND_BUCKET).download(path);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

export async function removeBrandLogo(supabase: TypedClient, path: string): Promise<void> {
  const { error } = await supabase.storage.from(BRAND_BUCKET).remove([path]);
  if (error) throw new Error(`logo : ${error.message}`);
}

