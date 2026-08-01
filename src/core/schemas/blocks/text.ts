import { z } from "zod";
import { zNarrativeContent } from "../entities/segments";

/**
 * Bloc `text` (layout: prose, specs/wiki-blocs.md §1, renomme depuis
 * `description` en V0-06e) : memes segments narratifs porteurs de
 * visibilite que l'ancien `entities.narrative_content`. Le type ne
 * presuppose plus un role — c'est le titre libre du bloc (« Description »,
 * « Histoire », « Resume »...) qui porte le sens, pas le type technique.
 */
export const zTextBlockData = z.object({
  __v: z.literal(1),
  segments: zNarrativeContent,
});
export type TextBlockData = z.infer<typeof zTextBlockData>;
