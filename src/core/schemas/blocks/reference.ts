import { z } from "zod";

/**
 * Reference partagee par les blocs de personnage (specs/wiki-blocs.md §4.1) :
 * soit une regle (cle stable, ex. "scimitar"), soit une entite du wiki (id
 * UUID, ex. Excalibur). C'est ici que l'unification wiki/regles devient
 * concrete dans les donnees — le meme inventaire pointe vers les deux
 * mondes. Distincte de `zReference` (rule-blocks/primitives.ts), qui relie
 * une fiche de regle a une AUTRE fiche de regle, jamais a une entite.
 */
export const zBlockReference = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("rule"), key: z.string().min(1) }),
  z.object({ kind: z.literal("entity"), id: z.string().min(1) }),
]);
export type BlockReference = z.infer<typeof zBlockReference>;
