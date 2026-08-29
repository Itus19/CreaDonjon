import { z } from "zod";

/**
 * Bloc `relations_graph` (V2-H1 phase 5) : graphe auto-organise des vraies
 * relations de l'entite (n'importe quel type, pas seulement la famille —
 * contrairement a `genealogy`). Ne stocke que la configuration
 * d'affichage ; les liens vivent dans `relations` (docs/SCHEMA.md §8).
 */
export const zRelationsGraphBlockData = z.object({
  __v: z.literal(1),
  rootEntityId: z.string().nullable().default(null),
  /** Nombre de sauts affiches depuis la racine — 1 par defaut (demande du client). */
  degreesVisible: z.number().int().min(1).max(4).default(1),
});
export type RelationsGraphBlockData = z.infer<typeof zRelationsGraphBlockData>;
