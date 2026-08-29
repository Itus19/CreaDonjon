import { z } from "zod";
import { zBlockReference } from "./reference";

/**
 * Bloc `quest` (V2-H4, specs/wiki-blocs.md §5) : le squelette narratif
 * d'une campagne. Recompenses et prerequis sont du texte libre pouvant
 * referencer une entite (meme primitive que les objectifs) — decision
 * explicite : pas de graphe de dependances entre quetes (une quete qui en
 * bloque une autre), non demande par le ticket et non trivial a arbitrer
 * (cycle, etat partiel). A construire le jour ou un cas concret l'exige.
 */
export const QUEST_STATES = ["not_started", "in_progress", "succeeded", "failed", "abandoned"] as const;
export type QuestState = (typeof QUEST_STATES)[number];

const zQuestObjective = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  done: z.boolean(),
  ref: zBlockReference.optional(),
});
export type QuestObjective = z.infer<typeof zQuestObjective>;

const zQuestNote = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  ref: zBlockReference.optional(),
});
export type QuestNote = z.infer<typeof zQuestNote>;

export const zQuestBlockData = z.object({
  __v: z.literal(1),
  state: z.enum(QUEST_STATES),
  giver: zBlockReference.nullable().default(null),
  objectives: z.array(zQuestObjective),
  rewards: z.array(zQuestNote),
  prerequisites: z.array(zQuestNote),
});
export type QuestBlockData = z.infer<typeof zQuestBlockData>;
