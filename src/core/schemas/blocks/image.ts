import { z } from "zod";

/**
 * Bloc `image` (layout: image, specs/wiki-blocs.md §1, renomme depuis
 * `gallery` en V0-06e — le multi-image n'a jamais servi en pratique) : une
 * seule image, avec une legende optionnelle en dessous. Pas de table
 * `assets`/upload en V0 : l'image est une URL externe collee, pas un
 * fichier stocke.
 */
export const zImageBlockData = z.object({
  __v: z.literal(1),
  url: z.string().default(""),
  caption: z.string().default(""),
});
export type ImageBlockData = z.infer<typeof zImageBlockData>;
