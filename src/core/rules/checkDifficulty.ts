import { z } from "zod";

/**
 * V3.2-22 (ADR 0113) — le palier de difficulté d'un test, et ce que le
 * moteur en tire.
 *
 * Le modèle ne rend JAMAIS un nombre (règle absolue 8) : il classe la phrase
 * dans une liste fermée, dont un palier. C'est ici, dans le noyau pur, que le
 * palier devient un DD, selon la table de D&D 2024 (très facile 5 … quasi
 * impossible 30), et que se décide la réussite automatique.
 */

export const CHECK_TIERS = ["tres_facile", "facile", "moyen", "difficile", "tres_difficile", "quasi_impossible"] as const;
export type CheckTier = (typeof CHECK_TIERS)[number];

const DC_BY_TIER: Record<CheckTier, number> = {
  tres_facile: 5,
  facile: 10,
  moyen: 15,
  difficile: 20,
  tres_difficile: 25,
  quasi_impossible: 30,
};

export function dcForTier(tier: CheckTier): number {
  return DC_BY_TIER[tier];
}

/**
 * Réussite automatique (ADR 0104 §4, ADR 0113 §3) : le pire jet possible
 * (un 1 naturel) réussit quand même. Le jugement « trivial » du modèle est
 * l'autre voie ; il se lit sur le classement, pas ici.
 */
export function autoSuccess({ tier, modifier }: { tier: CheckTier; modifier: number }): boolean {
  return 1 + modifier >= dcForTier(tier);
}

/**
 * Le classement que le modèle rend, validé tel quel. `.strict()` : un champ
 * de trop (un `dc` chiffré, par exemple) fait échouer la validation, et le
 * tour retombe sur le lexique.
 */
export const zCheckClassification = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("none") }).strict(),
  z.object({ kind: z.literal("trivial") }).strict(),
  z
    .object({
      kind: z.literal("check"),
      /** Une action de la fiche (clé de compétence, de caractéristique ou de sauvegarde), vérifiée ensuite contre la liste fournie. */
      action_id: z.string().min(1).max(80),
      tier: z.enum(CHECK_TIERS),
    })
    .strict(),
]);
export type CheckClassification = z.infer<typeof zCheckClassification>;
