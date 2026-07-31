import { z } from "zod";
import { zNarrativeContent } from "../entities/segments";

/**
 * Bloc `description` (layout: prose, specs/wiki-blocs.md §1) : memes
 * segments narratifs porteurs de visibilite que `entities.narrative_content`
 * (SCHEMA.md §6) — un bloc de description est structurellement un second
 * emplacement de prose, pas un format different.
 */
export const zDescriptionBlockData = z.object({
  __v: z.literal(1),
  segments: zNarrativeContent,
});
export type DescriptionBlockData = z.infer<typeof zDescriptionBlockData>;
