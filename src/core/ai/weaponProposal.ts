import { z } from "zod";

const DICE_FACES = [4, 6, 8, 10, 12] as const;
const zDiceFaces = z.union(DICE_FACES.map((f) => z.literal(f)) as [z.ZodLiteral<number>, ...z.ZodLiteral<number>[]]);
const CURRENCY_UNITS = ["gp", "sp", "cp", "ep", "pp"] as const;

/**
 * Forme que l'IA doit produire pour proposer une arme (V1-F2), pas le bloc
 * `zWeaponBlockData` complet (src/core/schemas/rule-blocks/blocks.ts) : elle
 * miroite exactement les champs de `CreateHomebrewWeaponForm.tsx`, le seul
 * endroit ou cette proposition atterrit. `properties`/`mastery` (references
 * a des entrees existantes du ruleset) restent hors de ce schema — le
 * formulaire manuel (V1-D4) ne les propose pas non plus aujourd'hui.
 *
 * Bornes numeriques volontairement etroites (des de 4 a 12, jusqu'a 10 des) :
 * memes limites d'esprit que les gardes-fous de l'AST cote moteur
 * (`9999d6` rejete — specs/regles-couche.md §5.3), appliquees ici au niveau
 * le plus tot possible.
 */
export const zWeaponProposal = z.object({
  category: z.enum(["simple", "martial"]),
  is_ranged: z.boolean(),
  damage_dice_count: z.number().int().min(1).max(10),
  damage_dice_faces: zDiceFaces,
  damage_type: z.string().min(1),
  versatile_dice_count: z.number().int().min(1).max(10).optional(),
  versatile_dice_faces: zDiceFaces.optional(),
  weight_lb: z.number().min(0).optional(),
  cost_quantity: z.number().min(0).optional(),
  cost_unit: z.enum(CURRENCY_UNITS).optional(),
});
export type WeaponProposal = z.infer<typeof zWeaponProposal>;

/**
 * Schema JSON de l'appel d'outil fourni au modele (contrat, specs/regles-couche.md
 * §5.1 : "le schema Zod du type d'entree lui est fourni comme contrat"). Ecrit
 * a la main plutot que via un convertisseur Zod->JSON Schema : neuf champs,
 * pas de justification a introduire une dependance pour ca (CLAUDE.md, section
 * dependances) — doit rester en phase avec `zWeaponProposal` ci-dessus, verifie
 * par les tests de ce fichier. La validation reelle reste `zWeaponProposal.safeParse`,
 * ce schema ne fait que guider le modele.
 */
export const weaponProposalToolSchema = {
  type: "object",
  properties: {
    category: { type: "string", enum: ["simple", "martial"], description: "Categorie de l'arme" },
    is_ranged: { type: "boolean", description: "Arme a distance" },
    damage_dice_count: { type: "integer", minimum: 1, maximum: 10 },
    damage_dice_faces: { type: "integer", enum: [...DICE_FACES] },
    damage_type: { type: "string", description: "ex. tranchant, perforant, contondant" },
    versatile_dice_count: { type: "integer", minimum: 1, maximum: 10, description: "Nombre de des a deux mains, si l'arme est polyvalente" },
    versatile_dice_faces: { type: "integer", enum: [...DICE_FACES] },
    weight_lb: { type: "number", minimum: 0, description: "Poids en livres" },
    cost_quantity: { type: "number", minimum: 0 },
    cost_unit: { type: "string", enum: [...CURRENCY_UNITS] },
  },
  required: ["category", "is_ranged", "damage_dice_count", "damage_dice_faces", "damage_type"],
} as const;
