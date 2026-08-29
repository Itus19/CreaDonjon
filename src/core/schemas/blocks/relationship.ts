import { z } from "zod";
import { zBlockReference } from "./reference";

/**
 * Bloc `relationship` (V2-H1, specs/psyche-pnj.md §3) : un bloc par
 * relation, decrit ce que l'entite hote ressent envers `target`. A la
 * difference de `personality`, ce bloc ne stocke PAS les valeurs des axes
 * — elles vivent dans `entity_attitudes`/`attitude_events`, portee
 * CAMPAGNE (« son opinion du groupe est propre a une partie »,
 * docs/adr/0013-tables-psyche-pnj.md). Le bloc ne porte que le structurel :
 * la cible, ce que l'entite croit savoir d'elle, combien d'historique
 * montrer.
 */
export const zRelationshipBlockData = z.object({
  __v: z.literal(1),
  target: zBlockReference.nullable().default(null),
  /** Ce que l'entite CROIT savoir de la cible (specs/psyche-pnj.md §3, "un mercenaire de passage") — jamais son identite reelle si le PNJ ne la connait pas. */
  knownAs: z.string().default(""),
  historyVisible: z.number().int().positive().default(20),
});
export type RelationshipBlockData = z.infer<typeof zRelationshipBlockData>;
