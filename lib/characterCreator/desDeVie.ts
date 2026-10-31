import { z } from "zod";
import { rollDice } from "@/src/core/dice/roll";
import type { Rng } from "@/src/core/dice/rng";

/**
 * V3.1-51 — « Lancer tous » : les dés de vie des niveaux au-delà du premier,
 * lancés par le serveur en un seul appel (règle 8). Le corps est STRICT : le
 * client n'envoie que le dé et le nombre de niveaux ; un corps qui porte un
 * résultat est refusé, jamais ignoré en silence.
 */
export const zLancerDesDeVie = z
  .object({
    dieFaces: z.union([z.literal(6), z.literal(8), z.literal(10), z.literal(12)]),
    /** Niveaux 2 à 20 : au plus dix-neuf jets. */
    count: z.number().int().min(1).max(19).default(1),
  })
  .strict();

export type LancerDesDeVie = z.infer<typeof zLancerDesDeVie>;

export function lancerDesDeVie(entree: LancerDesDeVie, rng: Rng): number[] {
  return rollDice(entree.count, entree.dieFaces, rng).rolls;
}
