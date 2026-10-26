import { zStatblockBlockData } from "@/src/core/schemas/blocks/statblock";
import type { Json } from "@/src/types/database";

/**
 * V3.1-147 — le repaire d'une fiche de créature (`statblock.lair`) ne porte
 * qu'un identifiant de fiche. Le wiki public et la coquille joueur le
 * résolvent ici, pour un lecteur donné : la fiche citée est visible, le bloc
 * part avec `lairRef` (nom et slug) ; elle ne l'est pas, l'identifiant est
 * RETIRÉ de la donnée du bloc et rien d'autre ne s'écrit (règle 5).
 *
 * Fonctions pures : l'appelant fournit les fiches visibles de SON lecteur,
 * c'est lui qui sait les calculer (anonyme ou joueur).
 */

interface BlocAvecDonnees {
  blockType: string;
  data: Json;
}

/** Les fiches citées comme repaire par les blocs `statblock` de la liste. */
export function lairEntityIds(blocks: readonly BlocAvecDonnees[]): string[] {
  const ids = new Set<string>();
  for (const block of blocks) {
    if (block.blockType !== "statblock") continue;
    const parsed = zStatblockBlockData.safeParse(block.data);
    if (parsed.success && parsed.data.lair) ids.add(parsed.data.lair.id);
  }
  return [...ids];
}

export function resolveLair<B extends BlocAvecDonnees>(
  block: B,
  visibles: ReadonlyMap<string, { name: string; slug: string }>
): B & { lairRef?: { name: string; slug: string } } {
  if (block.blockType !== "statblock") return block;
  const parsed = zStatblockBlockData.safeParse(block.data);
  if (!parsed.success || !parsed.data.lair) return block;
  const found = visibles.get(parsed.data.lair.id);
  if (found) return { ...block, lairRef: { name: found.name, slug: found.slug } };
  const sansRepaire: Record<string, unknown> = { ...parsed.data };
  delete sansRepaire.lair;
  return { ...block, data: sansRepaire as Json };
}
