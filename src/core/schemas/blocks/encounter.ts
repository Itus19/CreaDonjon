import { z } from "zod";
import { zBlockReference } from "./reference";

/**
 * Bloc `encounter` (layout: prose, V1-E3, specs/outils-mj.md §4.3) : une
 * rencontre composee, attachee a une entite (typiquement un lieu ou une
 * quete). `ref` est optionnel — relier un participant a une entite/regle le
 * rend cliquable, mais n'est jamais resolu automatiquement dans ce ticket
 * (meme discipline que `refs` sur `random_table`, V1-E1 : porte par le
 * schema, pas encore par une recherche assistee dans l'editeur). `xp` est
 * saisi par le MJ (les fiches de regle des creatures restent la reference
 * pour la trouver) plutot que resolu depuis le ruleset — un cas concret a
 * la fois.
 */

const zEncounterParticipant = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  xp: z.number().int().min(0),
  count: z.number().int().min(1),
  ref: zBlockReference.optional(),
});
export type EncounterParticipant = z.infer<typeof zEncounterParticipant>;

export const zEncounterBlockData = z.object({
  __v: z.literal(1),
  partyLevels: z.array(z.number().int().min(1).max(20)),
  participants: z.array(zEncounterParticipant),
});
export type EncounterBlockData = z.infer<typeof zEncounterBlockData>;
