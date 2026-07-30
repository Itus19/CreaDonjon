/** Liste fermee de ruleset_entries.entry_type (SCHEMA.md §9). */
export const ENTRY_TYPES = [
  "spell",
  "item",
  "weapon",
  "armor",
  "class",
  "subclass",
  "feature",
  "monster",
  "condition",
  "rule",
  "background",
  "species",
] as const;
export type EntryType = (typeof ENTRY_TYPES)[number];

/**
 * Blocs qu'un type d'entree doit posseder (specs/regles-blocs.md §5,
 * exemple donne au mot pres). Une entree a laquelle il manque un bloc
 * requis reste valide mais signalee — on avertit, on n'interdit pas.
 * weapon/monster referencent des blocs V2 (weapon, stat_block) pas encore
 * construits : le manque est donc attendu pour toute l'import SRD tant que
 * ces blocs n'existent pas, pas un bug de ce ticket. Les noms references ici
 * ne sont donc pas tous des BlockType valides aujourd'hui (weapon,
 * stat_block n'ont pas encore de schema Zod) : cette liste anticipe leur
 * arrivee, elle ne pretend pas qu'ils existent deja.
 */
export const REQUIRED_BLOCKS: Partial<Record<EntryType, string[]>> = {
  spell: ["spell_casting", "effects"],
  class: ["class_progression"],
  weapon: ["weapon"],
  monster: ["stat_block"],
};
