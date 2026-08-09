import { z } from "zod";
import { zBlockReference } from "./reference";
import { zAbilityScores } from "./abilities";

const zClassLevel = z.object({
  class: zBlockReference,
  level: z.number().int().positive(),
  subclass: zBlockReference.nullable(),
});

/**
 * Le genre d'un personnage, en donnee (V1-C4, specs/arbitrage-modifications.md
 * §3.9). `unspecified` (« on ne sait pas ») et `neutral` (« ni l'un ni
 * l'autre ») sont deux etats distincts, jamais confondus — c'est le choix
 * par defaut a la creation qui vaut `unspecified`, jamais `neutral`.
 */
const zGender = z.union([
  z.enum(["feminine", "masculine", "neutral", "unspecified"]),
  z.object({ custom: z.string().min(1) }),
]);

/**
 * Bloc `character` (specs/wiki-liens-et-personnages.md §B1, specs/wiki-blocs.md
 * §4.1) : le build, rien d'autre. Espece, classe(s), niveau, caracteristiques
 * attribuees, choix — jamais une valeur derivee (CA, PV, modificateurs...),
 * toujours recalculee par characterSheet() (src/core/rules/sheet.ts) a
 * l'affichage. `.strict()` fait echouer la validation si un champ derive
 * s'y glisse par erreur plutot que de le tolerer silencieusement.
 *
 * `gender`/`pronouns` optionnels (`.optional()`, pas `.default()`) : les
 * blocs `character` ecrits avant V1-C4 n'ont ni l'un ni l'autre, et
 * `.strict()` doit continuer a les valider tels quels plutot que d'inventer
 * une valeur qui n'a jamais ete choisie.
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
    gender: zGender.optional(),
    pronouns: z.string().optional(),
  })
  .strict();
export type CharacterBlockData = z.infer<typeof zCharacterBlockData>;
