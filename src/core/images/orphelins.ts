/**
 * V3.1-128 (docs/QUOTAS.md Q5, ADR 0057) — quelles images le stockage garde
 * pour rien. Partage par le recensement et l'effacement
 * (`scripts/imagesOrphelines.ts`) : les deux voient toujours la meme liste.
 *
 * Deux sortes d'orphelins :
 * - une ligne `assets` que rien ne designe : ni une table de liens
 *   (`block_images`, `entity_assets`, `background_images`), ni les donnees
 *   d'un bloc (meme regle que `app.asset_reference_count`) ;
 * - un fichier du stockage sans ligne `assets`.
 *
 * Ce qui a moins de `ageMinimumMs` est mis de cote : un envoi cree l'image
 * AVANT que le bloc ne la designe, et le fichier avant sa ligne. Une date
 * illisible compte comme recente : on n'efface pas ce qu'on ne sait pas dater.
 */
export interface AssetLu {
  id: string;
  world_id: string;
  storage_path: string;
  byte_size: number;
  created_at: string;
}

export interface FichierLu {
  chemin: string;
  octets: number;
  cree_le: string;
}

export interface Orphelins {
  lignes: AssetLu[];
  fichiers: FichierLu[];
  /** Orphelins apparents, mis de cote parce que trop recents. */
  recents: number;
}

const MARQUEUR_DOSSIER_VIDE = ".emptyFolderPlaceholder";

export function trouverOrphelins(params: {
  assets: readonly AssetLu[];
  texteDesBlocs: string;
  idsDesignes: ReadonlySet<string>;
  fichiers: readonly FichierLu[];
  maintenant: number;
  ageMinimumMs: number;
}): Orphelins {
  const assezVieux = (date: string) => {
    const t = Date.parse(date);
    return Number.isFinite(t) && params.maintenant - t >= params.ageMinimumMs;
  };
  let recents = 0;

  const lignes: AssetLu[] = [];
  for (const a of params.assets) {
    if (params.idsDesignes.has(a.id) || params.texteDesBlocs.includes(a.id)) continue;
    if (assezVieux(a.created_at)) lignes.push(a);
    else recents++;
  }

  const chemins = new Set(params.assets.map((a) => a.storage_path));
  const fichiers: FichierLu[] = [];
  for (const f of params.fichiers) {
    if (chemins.has(f.chemin) || f.chemin.endsWith(MARQUEUR_DOSSIER_VIDE)) continue;
    if (assezVieux(f.cree_le)) fichiers.push(f);
    else recents++;
  }

  lignes.sort((a, b) => a.id.localeCompare(b.id));
  fichiers.sort((a, b) => a.chemin.localeCompare(b.chemin));
  return { lignes, fichiers, recents };
}
