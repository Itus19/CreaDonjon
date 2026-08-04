import { z } from "zod";

/**
 * Les six caracteristiques, partagees par `character` (couche 1, valeurs
 * attribuees) et `statblock` (valeurs plates d'une creature). Meme six
 * cles que `Ability` dans src/core/rules/sheet.ts — redeclarees ici plutot
 * qu'importees : les schemas de blocs de wiki ne dependent pas du moteur de
 * regles, c'est la couche service qui les relie plus tard.
 */
export const zAbility = z.enum(["str", "dex", "con", "int", "wis", "cha"]);
export type BlockAbility = z.infer<typeof zAbility>;

export const zAbilityScores = z.object({
  str: z.number(),
  dex: z.number(),
  con: z.number(),
  int: z.number(),
  wis: z.number(),
  cha: z.number(),
});
export type AbilityScores = z.infer<typeof zAbilityScores>;
