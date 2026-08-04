import { z } from "zod";
import { zBlockReference } from "./reference";
import { zAbility } from "./abilities";

const zSpellSource = z.object({
  // Cle de la classe telle qu'elle apparait dans `character.classes[].class` —
  // chaine simple, pas une reference : une source d'incantation s'appuie
  // toujours sur une classe deja portee par le personnage.
  class: z.string().min(1),
  ability: zAbility,
});

const zKnownSpell = z.object({
  ref: zBlockReference,
  origin: z.string().min(1), // "spellbook" | "innate" | "granted"...
});

/**
 * Bloc `spellcasting` (specs/wiki-blocs.md §4.1). Les emplacements de sort
 * sont derives de la table de progression de la classe — on ne les stocke
 * pas ici, seulement leur consommation (etat de jeu, `entity_runtime_state`,
 * §4.2). `slot_override` couvre le cas rare d'une regle maison qui change
 * le nombre d'emplacements plutot que de le deriver.
 */
export const zSpellcastingBlockData = z.object({
  __v: z.literal(1),
  sources: z.array(zSpellSource),
  known: z.array(zKnownSpell),
  prepared: z.array(z.string()),
  slot_override: z.record(z.string(), z.number().int().nonnegative()).nullable(),
});
export type SpellcastingBlockData = z.infer<typeof zSpellcastingBlockData>;
