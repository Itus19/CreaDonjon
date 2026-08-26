import { z } from "zod";

/**
 * Enveloppe commune a tous les blocs de wiki (specs/wiki-blocs.md §1) :
 * meme forme que les blocs de regles (block_type, display, data), mais un
 * bloc de wiki porte en plus sa propre visibilite (colonne separee sur la
 * table `blocks`, pas dans `display`).
 */
export const zBlockDisplay = z.object({
  label: z.string().min(1),
  layout: z.enum([
    "prose",
    "key_values",
    "image",
    "table",
    "character",
    "inventory",
    "spellcasting",
    "resources",
    "statblock",
    "music",
  ]),
  collapsed: z.boolean().optional(),
});
export type BlockDisplay = z.infer<typeof zBlockDisplay>;
