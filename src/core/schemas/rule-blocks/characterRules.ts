import { z } from "zod";
import { ABILITIES, type Ability } from "../../rules/abilities";

/**
 * Règles de personnage d'un ruleset (V3.1-115, ADR 0046) : ce que le code
 * tenait en constantes (plafonds, génération des caractéristiques, charge,
 * revente, table du multiclassé, départ à haut niveau). Une fiche de règles
 * par ruleset porte ce bloc ; une variante le surcharge champ par champ.
 * Le noyau n'a AUCUNE valeur de repli : sans fiche, l'écran le dit.
 */
const zAbility = z.enum(ABILITIES as unknown as [Ability, ...Ability[]]);
const zScore = z.number().int().min(1).max(30);

const zPointBuy = z
  .object({
    budget: z.number().int().min(0),
    min: zScore,
    max: zScore,
    /** Coût de chaque valeur, de `min` à `max` inclus (clé : la valeur, en texte). */
    costs: z.record(z.string().regex(/^\d{1,2}$/), z.number().int().min(0)),
  })
  .refine((p) => p.min <= p.max, { message: "point_buy : min doit être inférieur ou égal à max." })
  .refine(
    (p) => Array.from({ length: p.max - p.min + 1 }, (_, i) => String(p.min + i)).every((k) => p.costs[k] !== undefined),
    { message: "point_buy : chaque valeur de min à max doit avoir un coût." }
  );

const zRoll = z
  .object({
    dice_count: z.number().int().min(1).max(10),
    dice_faces: z.number().int().min(2).max(100),
    keep_highest: z.number().int().min(1),
    /** Nombre de tirages, un par caractéristique d'ordinaire. */
    rolls: z.number().int().min(1).max(12),
  })
  .refine((r) => r.keep_highest <= r.dice_count, { message: "roll : keep_highest ne peut dépasser dice_count." });

export const zAbilityGeneration = z.object({
  standard_array: z.array(zScore).length(6).optional(),
  point_buy: zPointBuy.optional(),
  roll: zRoll.optional(),
});

/**
 * La charge, en livres par point de Force (unité native du SRD ; l'écran
 * convertit en kg). Au-delà d'un palier, une pénalité de vitesse et des
 * désavantages. Règle 2024 : capacité Force × 15 lb (7,5 kg), sans palier ;
 * la variante de 2014 en a deux (× 5 et × 10).
 */
export const zEncumbranceRules = z.object({
  capacity_per_strength_lb: z.number().positive(),
  tiers: z.array(
    z.object({
      above_per_strength_lb: z.number().positive(),
      speed_penalty_ft: z.number().int().min(0),
      disadvantage: z.array(zAbility),
    })
  ),
});
export type EncumbranceRules = z.infer<typeof zEncumbranceRules>;

export const zCharacterRulesBlockData = z.object({
  level_cap: z.number().int().min(1).max(30),
  /** Plafond d'une caractéristique (20 en 2024). Un objet qui FIXE une valeur (« Force 19 ») n'y est pas soumis. */
  ability_score_cap: zScore,
  ability_generation: zAbilityGeneration,
  encumbrance: zEncumbranceRules,
  /** Part du prix rendue à la revente (½ en 2024). */
  sell_ratio: z.number().min(0).max(1),
  /** Table du multiclassé (ADR 0045) : niveau de lanceur (« 1 » à « 20 ») → emplacements par niveau de sort. */
  multiclass_spell_slots: z.record(z.string().regex(/^\d{1,2}$/), z.array(z.number().int().min(0)).max(9)).optional(),
  /**
   * Départ à haut niveau, par palier (SRD 5.2.1, « Starting Equipment at
   * Higher Levels ») : `gold` po fixes, plus `gold_roll` (dés lancés par le
   * serveur, multipliés), plus des objets magiques à choisir par rareté
   * (V3.1-53). `magic_items` : ancien texte libre, gardé pour compatibilité.
   */
  starting_at_higher_level: z
    .array(
      z.object({
        min_level: z.number().int().min(1),
        max_level: z.number().int().min(1),
        gold: z.number().int().min(0),
        gold_roll: z.object({ count: z.number().int().min(1).max(10), faces: z.number().int().min(2).max(100), multiplier: z.number().int().min(1) }).optional(),
        magic_item_picks: z.array(z.object({ rarity: z.string().min(1), count: z.number().int().min(1).max(10) })).optional(),
        magic_items: z.string().optional(),
      })
    )
    .optional(),
});
export type CharacterRules = z.infer<typeof zCharacterRulesBlockData>;

/** Prérequis de multiclassage d'une classe : toutes les conditions de `all`, et au moins une de `any`. */
export const zMulticlassPrerequisites = z
  .object({
    all: z.array(z.object({ ability: zAbility, min: zScore })).optional(),
    any: z.array(z.object({ ability: zAbility, min: zScore })).optional(),
  })
  .refine((p) => (p.all?.length ?? 0) + (p.any?.length ?? 0) > 0, { message: "multiclass_prerequisites : au moins une condition." });
export type MulticlassPrerequisites = z.infer<typeof zMulticlassPrerequisites>;
