import { REQUIRED_BLOCKS, type EntryType } from "../schemas/rule-blocks/entry-types";

/**
 * Une entree a laquelle il manque un bloc requis reste valide mais
 * signalee (specs/regles-blocs.md §5) — jamais rejetee. Retourne la liste
 * des block_type manquants, vide si tout y est ou si ce type d'entree n'a
 * aucun bloc requis declare.
 */
export function missingRequiredBlocks(entryType: EntryType, presentBlockTypes: readonly string[]): string[] {
  const required = REQUIRED_BLOCKS[entryType] ?? [];
  return required.filter((blockType) => !presentBlockTypes.includes(blockType));
}
