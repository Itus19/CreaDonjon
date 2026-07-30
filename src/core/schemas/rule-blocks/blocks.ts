import { z } from "zod";
import { zFormulaNode, zLocalized } from "./primitives";

/**
 * Catalogue V1 des blocs de regles (specs/regles-blocs.md §5). Cinq blocs
 * plus l'echappatoire couvrent 90% du SRD ; le reste (weapon, armor,
 * stat_block, ...) vient quand un cas concret le reclame — regle des trois.
 */

export const BLOCK_TYPES = [
  "description",
  "spell_casting",
  "effects",
  "scaling",
  "class_progression",
  "custom_table",
] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

// --- description (layout: prose) ---------------------------------------
// Segments narratifs. Le modele complet des segments porteurs de visibilite
// (wiki-liens-et-personnages.md) s'applique aux entites ; pour une fiche de
// regle importee du SRD, chaque segment est public par construction (aucun
// n'a de raison d'etre cache au moment de l'import).
export const zDescriptionBlockData = z.object({
  segments: z.array(z.object({ text: z.string() })),
});
export type DescriptionBlockData = z.infer<typeof zDescriptionBlockData>;

// --- spell_casting (layout: key_values) ---------------------------------
export const zSpellCastingBlockData = z.object({
  level: z.number().int().min(0),
  school: z.string(),
  casting_time: z.string(),
  range: z.string(),
  components: z.array(z.enum(["V", "S", "M"])),
  material: z.string().optional(),
  duration: z.string(),
  concentration: z.boolean(),
  ritual: z.boolean(),
});
export type SpellCastingBlockData = z.infer<typeof zSpellCastingBlockData>;

// --- effects (layout: formula_list) -------------------------------------
export const zEffectData = z.object({
  id: z.string(),
  trigger: z.string().optional(),
  damage_type: z.string().optional(),
  formula: zFormulaNode.optional(),
  save: z.object({ ability: z.string(), effect_on_success: z.string().optional() }).optional(),
});
export const zEffectsBlockData = z.object({
  effects: z.array(zEffectData),
});
export type EffectsBlockData = z.infer<typeof zEffectsBlockData>;

// --- scaling (layout: progression_table, specs/regles-blocs.md §6) -----
export const zScalingRule = z.object({
  kind: z.literal("delta_per_step"),
  target: z.string(),
  per_step: zFormulaNode,
});
export const zScalingBlockData = z.object({
  axis: z.enum(["slot_level", "character_level", "uses", "custom"]),
  base: z.number(),
  rule: zScalingRule.nullable(),
  // La table prime quand elle est presente (progression irreguliere) ;
  // c'est la forme que produit l'import SRD, dont les paliers sont deja
  // enumeres explicitement dans la donnee source (damage_at_slot_level).
  table: z.record(z.string(), z.string()).nullable(),
});
export type ScalingBlockData = z.infer<typeof zScalingBlockData>;

// --- class_progression (layout: progression_table, specs/regles-blocs.md §7) ---
export const zProgressionColumn = z.object({
  key: z.string(),
  label: zLocalized,
  kind: z.enum(["level", "formula", "grants", "value"]),
  formula: zFormulaNode.optional(),
});
export const zProgressionRow = z.record(z.string(), z.unknown());
export const zClassProgressionBlockData = z.object({
  max_level: z.number().int().positive(),
  columns: z.array(zProgressionColumn),
  rows: z.array(zProgressionRow),
});
export type ClassProgressionBlockData = z.infer<typeof zClassProgressionBlockData>;

// --- custom_table (layout: table) — l'echappatoire, des le premier jour ---
export const zCustomTableBlockData = z.object({
  columns: z.array(z.string()),
  rows: z.array(z.record(z.string(), z.unknown())),
});
export type CustomTableBlockData = z.infer<typeof zCustomTableBlockData>;

// --- Enveloppe commune (specs/regles-blocs.md §2) -----------------------
export const zBlockDisplay = z.object({
  label: z.string(),
  layout: z.enum(["key_values", "progression_table", "formula_list", "prose", "chips", "table"]),
  collapsed: z.boolean().optional(),
});

const DATA_SCHEMA_BY_BLOCK_TYPE = {
  description: zDescriptionBlockData,
  spell_casting: zSpellCastingBlockData,
  effects: zEffectsBlockData,
  scaling: zScalingBlockData,
  class_progression: zClassProgressionBlockData,
  custom_table: zCustomTableBlockData,
} satisfies Record<BlockType, z.ZodTypeAny>;

/** Registre : le moteur demande le schema Zod d'un block_type et recoit une forme garantie. */
export function dataSchemaForBlockType(blockType: BlockType): z.ZodTypeAny {
  return DATA_SCHEMA_BY_BLOCK_TYPE[blockType];
}

export function validateBlockData(blockType: BlockType, data: unknown) {
  return dataSchemaForBlockType(blockType).parse(data);
}
