import { z } from "zod";
import type { ResolvedEffect } from "./triggers";

/**
 * V3.1-111 (ADR 0044) — la sauvegarde DEMANDÉE à la cible.
 *
 * Le moteur calcule l'effet à la demande (dégâts déjà lancés, états imposés)
 * et le fige dans `save_requests.effect` ; la réponse ne fait que choisir
 * l'issue. Rien n'est relancé à la réponse : les dégâts sont ceux que la
 * table a vus.
 */
const zSaveOutcome = z.object({
  damage: z.number().int().nonnegative(),
  damage_type: z.string().min(1).optional(),
  conditions: z.array(z.string().min(1)),
});

export const zSaveRequestEffect = z.object({
  on_fail: zSaveOutcome,
  on_success: zSaveOutcome,
});
export type SaveRequestEffect = z.infer<typeof zSaveRequestEffect>;

/**
 * Le total d'une sauvegarde : le naturel plus le bonus — sauf « modificateur
 * inclus » (vrai dé, le joueur a fait l'addition), où le total passe tel quel
 * et le naturel n'est pas connu.
 */
export function saveTotal(die: { natural: number; modifierIncluded: boolean }, bonus: number): { natural: number | null; total: number } {
  return die.modifierIncluded ? { natural: null, total: die.natural } : { natural: die.natural, total: die.natural + bonus };
}

/** Les effets de l'issue tombée, sur la cible (`who` : la clé d'acteur du tour). */
export function effectsForSaveOutcome(effect: SaveRequestEffect, passed: boolean, who: string): ResolvedEffect[] {
  const outcome = passed ? effect.on_success : effect.on_fail;
  const effects: ResolvedEffect[] = [];
  if (outcome.damage > 0) {
    effects.push({ action: "deal_damage", who, amount: outcome.damage, ...(outcome.damage_type ? { damage_type: outcome.damage_type } : {}) });
  }
  for (const key of outcome.conditions) effects.push({ action: "apply_condition", who, key });
  return effects;
}
