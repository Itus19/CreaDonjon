// V3.1-128 — lecture partagee par `recenser-images-orphelines.ts` et
// `effacer-images-orphelines.ts` : les deux voient la meme liste, calculee
// par `src/core/images/orphelins.ts`. Ce module ne fait que LIRE.

import { createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database";
import { trouverOrphelins, type AssetLu, type FichierLu, type Orphelins } from "../src/core/images/orphelins";

export const BUCKET = "assets";
const PAGE = 1000;
/** Un envoi en cours cree l'image avant que le bloc ne la designe : on laisse une heure. */
const AGE_MINIMUM_MS = 60 * 60 * 1000;

export function clientAdmin(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cle = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !cle) throw new Error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent etre definies (voir .env.local).");
  return createClient<Database>(url, cle, { auth: { persistSession: false } });
}

/** Toutes les lignes d'une lecture, page par page (PostgREST plafonne chaque reponse). */
async function toutLire<T>(lire: (de: number, a: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const tout: T[] = [];
  for (let de = 0; ; de += PAGE) {
    const { data, error } = await lire(de, de + PAGE - 1);
    if (error) throw new Error(error.message);
    tout.push(...(data ?? []));
    if (!data || data.length < PAGE) return tout;
  }
}

/** Les fichiers du stockage, dossier par dossier (un dossier par monde). */
async function fichiersDuStockage(admin: SupabaseClient<Database>): Promise<FichierLu[]> {
  const dossiers = await admin.storage.from(BUCKET).list("", { limit: PAGE });
  if (dossiers.error) throw new Error(dossiers.error.message);
  const fichiers: FichierLu[] = [];
  for (const dossier of dossiers.data) {
    for (let offset = 0; ; offset += PAGE) {
      const { data, error } = await admin.storage.from(BUCKET).list(dossier.name, { limit: PAGE, offset });
      if (error) throw new Error(error.message);
      for (const f of data) {
        const taille = (f.metadata as { size?: unknown } | null)?.size;
        fichiers.push({ chemin: `${dossier.name}/${f.name}`, octets: typeof taille === "number" ? taille : 0, cree_le: f.created_at ?? "" });
      }
      if (data.length < PAGE) break;
    }
  }
  return fichiers;
}

export interface Recensement extends Orphelins {
  totalFichiers: number;
  totalOctets: number;
  totalLignes: number;
}

/**
 * Lit une fois les donnees de tous les blocs : quelques Mo de sortie reseau
 * (docs/QUOTAS.md T4). A lancer rarement.
 */
export async function recenser(admin: SupabaseClient<Database>, mondeId: string | null = null): Promise<Recensement> {
  const [assets, blocs, blockImages, entityAssets, fonds, fichiers] = await Promise.all([
    toutLire<AssetLu>((de, a) => admin.from("assets").select("id, world_id, storage_path, byte_size, created_at").order("id").range(de, a)),
    toutLire((de, a) => admin.from("blocks").select("data").order("id").range(de, a)),
    toutLire((de, a) => admin.from("block_images").select("asset_id").range(de, a)),
    toutLire((de, a) => admin.from("entity_assets").select("asset_id").range(de, a)),
    toutLire((de, a) => admin.from("background_images").select("asset_id").range(de, a)),
    fichiersDuStockage(admin),
  ]);

  const idsDesignes = new Set<string>();
  for (const ligne of [...blockImages, ...entityAssets, ...fonds]) if (ligne.asset_id) idsDesignes.add(ligne.asset_id);
  // Un monde seulement : ses lignes et ses fichiers (dossier `<monde>/`). Les
  // references, elles, restent cherchees partout.
  const dansLeMonde = <T,>(liste: T[], monde: (x: T) => string) => (mondeId ? liste.filter((x) => monde(x) === mondeId) : liste);
  const orphelins = trouverOrphelins({
    assets: dansLeMonde(assets, (a) => a.world_id),
    texteDesBlocs: blocs.map((b) => JSON.stringify(b.data)).join("\n"),
    idsDesignes,
    fichiers: dansLeMonde(fichiers, (f) => f.chemin.split("/")[0]),
    maintenant: Date.now(),
    ageMinimumMs: AGE_MINIMUM_MS,
  });
  return {
    ...orphelins,
    totalFichiers: fichiers.length,
    totalOctets: fichiers.reduce((n, f) => n + f.octets, 0),
    totalLignes: assets.length,
  };
}

/** Empreinte courte de la liste a effacer : l'effacement exige celle de la liste relue. */
export function empreinte(orphelins: Orphelins): string {
  const contenu = [...orphelins.lignes.map((l) => `ligne:${l.id}`), ...orphelins.fichiers.map((f) => `fichier:${f.chemin}`)].join("\n");
  return createHash("sha256").update(contenu).digest("hex").slice(0, 12);
}

export const mo = (octets: number) => `${(octets / 1048576).toFixed(2)} Mo`;

export function afficher(r: Recensement): void {
  console.log(`Stockage : ${r.totalFichiers} fichiers, ${mo(r.totalOctets)} sur 1 Go (plan gratuit). Lignes assets : ${r.totalLignes}.`);
  console.log(`\nImages que plus rien ne designe : ${r.lignes.length}, ${mo(r.lignes.reduce((n, a) => n + a.byte_size, 0))}`);
  for (const a of r.lignes) console.log(`  ${a.id}  monde ${a.world_id}  ${mo(a.byte_size)}  envoyee le ${a.created_at.slice(0, 10)}`);
  console.log(`\nFichiers sans ligne assets : ${r.fichiers.length}, ${mo(r.fichiers.reduce((n, f) => n + f.octets, 0))}`);
  for (const f of r.fichiers) console.log(`  ${f.chemin}  ${mo(f.octets)}`);
  if (r.recents > 0) console.log(`\n${r.recents} orphelin(s) apparent(s) de moins d'une heure, mis de cote (envoi peut-etre en cours).`);
}
