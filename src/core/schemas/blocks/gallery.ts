import { z } from "zod";

/**
 * Bloc `gallery` (layout: gallery, specs/wiki-blocs.md §1) : images avec
 * legendes, une en portrait. Pas de table `assets`/upload en V0 : chaque
 * image est une URL externe collee, pas un fichier stocke.
 */
export const zGalleryImage = z.object({
  url: z.url(),
  caption: z.string(),
  isPortrait: z.boolean().default(false),
});
export type GalleryImage = z.infer<typeof zGalleryImage>;

export const zGalleryBlockData = z.object({
  __v: z.literal(1),
  images: z.array(zGalleryImage),
});
export type GalleryBlockData = z.infer<typeof zGalleryBlockData>;
