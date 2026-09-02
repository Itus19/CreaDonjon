import { z } from "zod";

/**
 * Vocabulaire de primitives partage par tous les blocs de regles
 * (specs/regles-blocs.md §3). Toutes les valeurs de tous les blocs se
 * composent a partir de ces dix formes, et de ces dix formes seules —
 * ajouter une primitive est une decision d'architecture, a consigner en ADR.
 */

export const zQuantity = z.object({
  value: z.number(),
  unit: z.string(),
});
export type Quantity = z.infer<typeof zQuantity>;

/**
 * Miroir Zod exact de FormulaNode (src/core/formula/ast.ts). Un noeud non
 * reconnu doit echouer la validation, jamais etre accepte silencieusement.
 */
export const zFormulaNode: z.ZodType<import("../../formula/ast").FormulaNode> = z.lazy(() =>
  z.discriminatedUnion("op", [
    z.object({ op: z.literal("num"), value: z.number() }),
    z.object({
      op: z.literal("dice"),
      count: z.number().int().positive(),
      faces: z.number().int().positive(),
      keep: z
        .object({ mode: z.enum(["kh", "kl"]), count: z.number().int().positive() })
        .optional(),
    }),
    z.object({ op: z.literal("ref"), name: z.string() }),
    z.object({ op: z.literal("add"), args: z.tuple([zFormulaNode, zFormulaNode]) }),
    z.object({ op: z.literal("sub"), args: z.tuple([zFormulaNode, zFormulaNode]) }),
    z.object({ op: z.literal("mul"), args: z.tuple([zFormulaNode, zFormulaNode]) }),
    z.object({ op: z.literal("div"), args: z.tuple([zFormulaNode, zFormulaNode]) }),
    z.object({ op: z.literal("min"), args: z.array(zFormulaNode).min(1) }),
    z.object({ op: z.literal("max"), args: z.array(zFormulaNode).min(1) }),
    z.object({ op: z.literal("floor"), args: z.tuple([zFormulaNode]) }),
    z.object({ op: z.literal("ceil"), args: z.tuple([zFormulaNode]) }),
    z.object({ op: z.literal("round"), args: z.tuple([zFormulaNode]) }),
  ])
);

export const zReference = z.object({
  kind: z.enum(["rule", "entry", "entity"]),
  key: z.string(),
});
export type ReferencePrimitive = z.infer<typeof zReference>;

export const zDuration = z.object({
  type: z.string(),
  value: z.number().optional(),
  concentration: z.boolean().optional(),
});
export type Duration = z.infer<typeof zDuration>;

export const zRange = z.object({
  type: z.string(),
  distance: zQuantity.optional(),
});
export type Range = z.infer<typeof zRange>;

export const zArea = z.object({
  shape: z.string(),
  size: zQuantity,
});
export type Area = z.infer<typeof zArea>;

export const zGrant = z.object({
  feature: z.string().optional(),
  choice: z.string().optional(),
  resource: z.string().optional(),
});
export type Grant = z.infer<typeof zGrant>;

// Forme complete precisee par specs/wiki-liens-et-personnages.md (fiche de
// personnage) — volontairement permissive ici, aucun bloc de l'import SRD
// (P0-08) n'en depend encore pour le detail (choix multi-niveaux, etc.).
export const zChoice = z.object({
  id: z.string(),
  prompt: z.string(),
  count: z.number().int().positive(),
  from: z.array(z.string()),
  grants: z.array(zGrant).optional(),
});
export type Choice = z.infer<typeof zChoice>;

/**
 * Modificateur declare par une fiche de regle (bloc `modifiers`,
 * specs/regles-blocs.md §3/§5) — miroir exact des huit operations que
 * `characterSheet()` sait appliquer (`ModifierOp`, src/core/rules/sheet.ts),
 * jamais un vocabulaire different a faire correspondre plus tard. Ni
 * `source`, ni `label`, ni `layer` ici : ces trois-la dependent d'OU la
 * fiche est accrochee sur un personnage (aptitude de classe, don accorde
 * par un historique...), jamais de la fiche elle-meme — `resolveDeclaredModifiers`
 * (src/core/rules/sheet.ts) les attache a la resolution. `value` est un
 * simple nombre, jamais une formule : le moteur (`Modifier.value` dans
 * sheet.ts) ne sait consommer que ca aujourd'hui, un `FormulaNode` accepte
 * ici serait une promesse non tenue.
 */
export const zModifier = z.object({
  target: z.string(),
  op: z.enum(["add", "set", "min", "max", "advantage", "disadvantage", "proficiency", "expertise"]),
  value: z.number().optional(),
});
export type Modifier = z.infer<typeof zModifier>;

export const zLocalized = z.record(z.string(), z.string());
export type Localized = z.infer<typeof zLocalized>;
