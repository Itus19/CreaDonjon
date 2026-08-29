import { z } from "zod";
import { WORLDVIEW_POLE_KEYS } from "@/src/core/psyche/keys";

/**
 * Bloc `worldview` (V2-H1, specs/psyche-pnj.md §2) : convictions morales/
 * politiques, separees du temperament (`personality`) — attachable aussi
 * a une faction. Meme portee que `personality` (l'entite seule, jamais la
 * campagne : « Bram est Bram partout »), meme journal partage
 * (`personality_events`, filtre par cles de poles a l'affichage — pas de
 * nouvelle table pour un second jeu de poles qui vit exactement de la
 * meme facon).
 */
const zWorldviewPole = z.object({
  key: z.enum(WORLDVIEW_POLE_KEYS),
  value: z.number().int().min(-100).max(100),
  note: z.string().optional(),
});

export const zWorldviewBlockData = z.object({
  __v: z.literal(1),
  poles: z.array(zWorldviewPole),
  priority: z.array(z.enum(WORLDVIEW_POLE_KEYS)).default([]),
});
export type WorldviewBlockData = z.infer<typeof zWorldviewBlockData>;
