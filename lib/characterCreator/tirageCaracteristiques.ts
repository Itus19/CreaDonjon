import { z } from "zod";
import { rollDice } from "@/src/core/dice/roll";
import type { Rng } from "@/src/core/dice/rng";

/**
 * V3.1-52 — Le tirage des caractéristiques, fait par le serveur (règle 8).
 * Le corps est STRICT : le client n'envoie que le monde (dont le ruleset dit
 * comment tirer) ; un corps qui porte des valeurs est refusé.
 */
export const zTirageCaracteristiques = z
  .object({
    worldSlug: z.string().trim().min(1).max(200),
  })
  .strict();

export interface FormuleTirage {
  dice_count: number;
  dice_faces: number;
  keep_highest: number;
  rolls: number;
}

/** Les tirages selon la formule du ruleset (4d6, garder les trois meilleurs, six fois, en 2024). */
export function tirerCaracteristiques(formule: FormuleTirage, rng: Rng): number[] {
  return Array.from({ length: formule.rolls }, () => rollDice(formule.dice_count, formule.dice_faces, rng, { mode: "kh", count: formule.keep_highest }).total);
}
