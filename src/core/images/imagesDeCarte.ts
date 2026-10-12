/**
 * V3.1-128 (docs/QUOTAS.md Q5) — les images qu'un bloc `map` designe, et
 * celles qu'un enregistrement abandonne. Le serveur ne les efface ensuite
 * que si plus rien ne les designe (`asset_reference_count`) : une carte
 * dupliquee partage les images de l'original.
 *
 * Lit des donnees non validees (`unknown`) : ce qui est illisible ne
 * designe aucune image, donc rien n'est efface par erreur.
 */
export function imagesDeCarte(data: unknown): string[] {
  if (typeof data !== "object" || data === null) return [];
  const carte = data as { mode?: unknown; assetId?: unknown; thumbnailAssetId?: unknown };
  if (carte.mode !== "own") return [];
  const ids = [carte.assetId, carte.thumbnailAssetId].filter((id): id is string => typeof id === "string" && id !== "");
  return [...new Set(ids)];
}

/** Les images de `avant` que `apres` ne designe plus ; `apres` a `null` pour un bloc supprime. */
export function imagesAbandonnees(avant: unknown, apres: unknown): string[] {
  const gardees = new Set(imagesDeCarte(apres));
  return imagesDeCarte(avant).filter((id) => !gardees.has(id));
}
