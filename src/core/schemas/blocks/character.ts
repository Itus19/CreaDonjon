import { z } from "zod";
import { zBlockReference } from "./reference";
import { zAbilityScores } from "./abilities";

const zClassLevel = z.object({
  class: zBlockReference,
  level: z.number().int().positive(),
  subclass: zBlockReference.nullable(),
});

/**
 * Bloc `character` (specs/wiki-liens-et-personnages.md §B1, specs/wiki-blocs.md
 * §4.1) : le build, rien d'autre. Espece, classe(s), niveau, caracteristiques
 * attribuees, choix — jamais une valeur derivee (CA, PV, modificateurs...),
 * toujours recalculee par characterSheet() (src/core/rules/sheet.ts) a
 * l'affichage. `.strict()` fait echouer la validation si un champ derive
 * s'y glisse par erreur plutot que de le tolerer silencieusement.
 */
export const zCharacterBlockData = z
  .object({
    __v: z.literal(1),
    species: zBlockReference.nullable(),
    background: zBlockReference.nullable(),
    classes: z.array(zClassLevel),
    abilities: z.object({
      method: z.enum(["standard_array", "point_buy", "roll"]),
      base: zAbilityScores,
    }),
    // Les valeurs varient par cle : tableau de choix multiples, ou objet
    // structure pour une augmentation de caracteristique (§B2). Cle
    // qualifiee par origine (ex. "fighter.l1.c1") pour eviter toute
    // collision entre classes en cas de multiclassage.
    choices: z.record(z.string(), z.unknown()),
    hp_method: z.enum(["fixed", "rolled"]),
    portrait_asset_id: z.string().nullable(),
  })
  .strict();
export type CharacterBlockData = z.infer<typeof zCharacterBlockData>;
