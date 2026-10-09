import { REQUIRED_BLOCKS, type EntryType } from "../schemas/rule-blocks/entry-types";

/** Ce que le controle peut lire de l'entree en plus de ses types de blocs. */
export interface RequiredBlocksContext {
  /** Texte brut du bloc `description` (segments mis bout a bout), s'il y en a un. */
  descriptionText?: string;
}

// V3.1-1 : sur les 339 sorts du SRD 5.2.1, 66 seulement portent un effet
// chiffre ; les autres (buffs, utilitaires, mise en scene) n'en ont
// legitimement aucun. Un sort n'est donc attendu avec `effects` que si sa
// description parle d'une mecanique que ce bloc porte : un jet de
// sauvegarde, un jet d'attaque de sort, ou des des de degats ou de soins.
// Anglais (import SRD) et francais (traductions, fiches maison), accents
// optionnels.
const SAVE = /saving throw|jet de sauvegarde/i;
const SPELL_ATTACK = /spell attack|attaque de sort/i;
const DICE = /\b\d*d(4|6|8|10|12|20)\b/i;
const DAMAGE_OR_HEALING = /damage|d[eé]g[aâ]ts|hit points|points de vie/i;

function descriptionNeedsEffects(text: string): boolean {
  return SAVE.test(text) || SPELL_ATTACK.test(text) || (DICE.test(text) && DAMAGE_OR_HEALING.test(text));
}

/** Blocs requis seulement sous condition, par type d'entree. */
const CONDITIONAL_BLOCKS: Partial<Record<EntryType, { blockType: string; when: (ctx: RequiredBlocksContext) => boolean }[]>> = {
  spell: [{ blockType: "effects", when: (ctx) => descriptionNeedsEffects(ctx.descriptionText ?? "") }],
};

/**
 * Une entree a laquelle il manque un bloc requis reste valide mais
 * signalee (specs/regles-blocs.md §5) — jamais rejetee. Retourne la liste
 * des block_type manquants, vide si tout y est ou si ce type d'entree n'a
 * aucun bloc requis declare.
 */
export function missingRequiredBlocks(
  entryType: EntryType,
  presentBlockTypes: readonly string[],
  context: RequiredBlocksContext = {}
): string[] {
  const required = [
    ...(REQUIRED_BLOCKS[entryType] ?? []),
    ...(CONDITIONAL_BLOCKS[entryType] ?? []).filter((c) => c.when(context)).map((c) => c.blockType),
  ];
  return required.filter((blockType) => !presentBlockTypes.includes(blockType));
}
