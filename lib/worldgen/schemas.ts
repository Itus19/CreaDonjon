import { z } from "zod";

/** Les rayons proposés au MJ, en kilomètres par la route : une journée de marche, deux, quatre. */
export const REVEAL_RADII_KM = [25, 50, 100] as const;

/** G-7b — « Révéler les lieux alentour » : le lieu de départ et le rayon (règle 4). */
export const revealPlacesSchema = z.object({
  worldSlug: z.string().min(1).max(200),
  entityId: z.guid(),
  radiusKm: z.union([z.literal(25), z.literal(50), z.literal(100)]),
});
