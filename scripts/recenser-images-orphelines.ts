// V3.1-128 (docs/QUOTAS.md Q5) — recense les images que plus rien ne designe,
// en LECTURE SEULE. Il n'efface rien : l'auteur decide.
//
// Deux sortes d'orphelins :
// - une ligne `assets` qu'aucun bloc (donnees), `block_images`,
//   `entity_assets` ni `background_images` ne designe (meme regle que
//   `app.asset_reference_count`) ;
// - un fichier du stockage sans ligne `assets` (envoi interrompu, ancien
//   nettoyage partiel).
//
// Cout (docs/QUOTAS.md T4) : lit une fois les donnees de tous les blocs,
// quelques Mo de sortie reseau. A lancer rarement, pas en boucle.
//
// Lancement : npm run recenser:images-orphelines

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent etre definies (voir .env.local).");
}
const admin: SupabaseClient<Database> = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const BUCKET = "assets";
const PAGE = 1000;

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
async function fichiersDuStockage(): Promise<{ chemin: string; octets: number }[]> {
  const dossiers = await admin.storage.from(BUCKET).list("", { limit: PAGE });
  if (dossiers.error) throw new Error(dossiers.error.message);
  const fichiers: { chemin: string; octets: number }[] = [];
  for (const dossier of dossiers.data) {
    for (let offset = 0; ; offset += PAGE) {
      const { data, error } = await admin.storage.from(BUCKET).list(dossier.name, { limit: PAGE, offset });
      if (error) throw new Error(error.message);
      for (const f of data) {
        const taille = (f.metadata as { size?: unknown } | null)?.size;
        fichiers.push({ chemin: `${dossier.name}/${f.name}`, octets: typeof taille === "number" ? taille : 0 });
      }
      if (data.length < PAGE) break;
    }
  }
  return fichiers;
}

const mo = (octets: number) => `${(octets / 1048576).toFixed(2)} Mo`;

async function main(): Promise<void> {
  const [assets, blocs, blockImages, entityAssets, fonds, fichiers] = await Promise.all([
    toutLire((de, a) => admin.from("assets").select("id, world_id, storage_path, byte_size, created_at").range(de, a)),
    toutLire((de, a) => admin.from("blocks").select("data").range(de, a)),
    toutLire((de, a) => admin.from("block_images").select("asset_id").range(de, a)),
    toutLire((de, a) => admin.from("entity_assets").select("asset_id").range(de, a)),
    toutLire((de, a) => admin.from("background_images").select("asset_id").range(de, a)),
    fichiersDuStockage(),
  ]);

  const designees = new Set<string>();
  for (const ligne of [...blockImages, ...entityAssets, ...fonds]) if (ligne.asset_id) designees.add(ligne.asset_id);
  const texteDesBlocs = blocs.map((b) => JSON.stringify(b.data)).join("\n");

  const lignesOrphelines = assets.filter((a) => !designees.has(a.id) && !texteDesBlocs.includes(a.id));
  const chemins = new Set(assets.map((a) => a.storage_path));
  const fichiersSansLigne = fichiers.filter((f) => !chemins.has(f.chemin) && !f.chemin.endsWith(".emptyFolderPlaceholder"));

  const total = fichiers.reduce((n, f) => n + f.octets, 0);
  console.log(`Stockage : ${fichiers.length} fichiers, ${mo(total)} sur 1 Go (plan gratuit).`);
  console.log(`Lignes assets : ${assets.length}.`);

  console.log(`\nImages que plus rien ne designe : ${lignesOrphelines.length}, ${mo(lignesOrphelines.reduce((n, a) => n + a.byte_size, 0))}`);
  for (const a of lignesOrphelines) console.log(`  ${a.id}  monde ${a.world_id}  ${mo(a.byte_size)}  envoyee le ${a.created_at.slice(0, 10)}`);

  console.log(`\nFichiers sans ligne assets : ${fichiersSansLigne.length}, ${mo(fichiersSansLigne.reduce((n, f) => n + f.octets, 0))}`);
  for (const f of fichiersSansLigne) console.log(`  ${f.chemin}  ${mo(f.octets)}`);

  console.log("\nRien n'a ete efface. Une image de l'historique d'une fiche n'est pas comptee comme designee (ADR 0057).");
}

main().catch((erreur: unknown) => {
  console.error("Recensement interrompu", erreur);
  process.exit(1);
});
