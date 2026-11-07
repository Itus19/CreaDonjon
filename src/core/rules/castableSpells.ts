import type { BlockReference } from "../schemas/blocks/reference";

/**
 * Le personnage peut-il lancer ce sort ? Un sort connu (bloc `spellcasting`),
 * ou un sort qu'une aptitude lui accorde (`sheet.grantedSpells`, V3.1-118 :
 * sorts toujours préparés d'une sous-classe), qui n'a pas à figurer parmi les
 * connus. Pur.
 */
export function canCastSpell(
  known: readonly { ref: BlockReference }[] | undefined,
  granted: readonly { key: string }[],
  spellKey: string
): boolean {
  return (known ?? []).some((k) => k.ref.kind === "rule" && k.ref.key === spellKey) || granted.some((g) => g.key === spellKey);
}
