import { z } from "zod";
import { ENTRY_TYPES } from "./entry-types";

/**
 * Charge utile d'une surcharge `action = 'add_entry'` (V1-D4) : une fiche
 * qui n'existe dans aucune base de la chaine. Contrairement a une entree
 * SRD importee, une fiche maison n'a ni `ruleset_entries` ni
 * `ruleset_entry_translations` (les deux exigent un `entry_id` qui n'existe
 * pas ici) — son nom voyage donc directement dans la charge utile de la
 * surcharge plutot que par une table de traduction.
 */
export const zAddEntryPayload = z.object({
  name: z.string().min(1),
  entry_type: z.enum(ENTRY_TYPES),
});
export type AddEntryPayload = z.infer<typeof zAddEntryPayload>;
