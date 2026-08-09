import "server-only";
import { randomInt } from "node:crypto";
import type { Rng } from "@/src/core/dice/rng";

/**
 * Seule source d'entropie reelle du serveur pour les jets de la fiche
 * jouable (V1-B5) — jamais `Math.random()` en dur (CLAUDE.md regle 6,
 * SCHEMA.md §20.3). `campaigns.rng_seed`/`dice_rolls.seed_step`
 * (SCHEMA.md §11, §14) visent le rejeu deterministe d'une partie EN SOLO
 * (l'IA arbitre) — hors perimetre ici, aucune IA n'est impliquee : ce
 * generateur consomme une entropie fraiche a chaque jet. Rattacher les
 * jets manuels a la graine de campagne restera a faire quand le mode solo
 * (V1-D2+/V3) en aura reellement besoin.
 */
export const serverRng: Rng = {
  nextInt: (maxExclusive: number) => randomInt(maxExclusive),
};
