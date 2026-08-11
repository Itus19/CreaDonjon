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
 *
 * V1-D1 (12 aout) : `weapon`/`armor`/`item_properties`/`class_basics`/
 * `subclass_slot`/`stat_block`/`actions` ont maintenant un vrai schema Zod
 * (`src/core/schemas/rule-blocks/blocks.ts`) — mais ce ticket ne touche pas
 * l'import (`scripts/ingest-srd.ts`, V1-D2), donc aucune entree n'en a
 * encore reellement en base. Le manque reste attendu jusqu'a V1-D2, pas un
 * bug de celui-ci. `charges`/`prerequisites`/`traits`/
 * `spellcasting_progression` restent volontairement hors de cette liste :
 * trop d'entrees n'en ont legitimement pas (la plupart des objets n'ont pas
 * de charges, la plupart des dons n'ont pas de prerequis, toutes les
 * classes n'incantent pas) pour en faire une exigence globale par type.
 */
export const REQUIRED_BLOCKS: Partial<Record<EntryType, string[]>> = {
  spell: ["spell_casting", "effects"],
  class: ["class_progression", "class_basics", "subclass_slot"],
  weapon: ["weapon"],
  armor: ["armor"],
  item: ["item_properties"],
  monster: ["stat_block", "actions"],
};
