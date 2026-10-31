import { z } from "zod";
import { rollDice } from "@/src/core/dice/roll";
import type { Rng } from "@/src/core/dice/rng";

/**
 * V3.1-53 — Les dés de l'or de départ à haut niveau (1d10 × 25 po au SRD),
 * lancés par le serveur (règle 8). Le corps est STRICT : le client n'envoie
 * que les dés du palier ; un corps qui porte un résultat est refusé.
 */
export const zLancerOrDeDepart = z
  .object({
    count: z.number().int().min(1).max(10),
    faces: z.number().int().min(2).max(100),
  })
  .strict();

export type LancerOrDeDepart = z.infer<typeof zLancerOrDeDepart>;

export function lancerOrDeDepart(entree: LancerOrDeDepart, rng: Rng): number[] {
  return rollDice(entree.count, entree.faces, rng).rolls;
}
