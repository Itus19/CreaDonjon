import { z } from "zod";

/** `#RRGGBB` seulement — jamais `rgb()`/nommees, un seul format a valider partout (saisie, stockage, rendu SVG direct). */
export const zMapRegionColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Couleur invalide (format #RRGGBB).");
export type MapRegionColor = z.infer<typeof zMapRegionColor>;

/** Sommet normalise (0-1), memes conventions que x/y de map_pins — jamais des pixels, casserait a chaque remplacement d'image. */
export const zMapRegionPoint = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) });
export type MapRegionPoint = z.infer<typeof zMapRegionPoint>;

/** Polygone : au moins 3 sommets, sinon ce n'est pas une zone. */
export const zMapRegionShape = z.array(zMapRegionPoint).min(3, "Une zone a besoin d'au moins 3 sommets.");
export type MapRegionShape = z.infer<typeof zMapRegionShape>;
