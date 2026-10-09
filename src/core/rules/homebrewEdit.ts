import {
  zBackgroundBlockData,
  zDescriptionBlockData,
  zEffectsBlockData,
  zModifiersBlockData,
  zPrerequisitesBlockData,
  zScalingBlockData,
  zSpellCastingBlockData,
  zSubclassFeaturesBlockData,
  zTriggersBlockData,
  zWeaponBlockData,
} from "../schemas/rule-blocks/blocks";
import type { Trigger } from "./triggers";
import { formatFormulaNode } from "../formula/format";
import type { HomebrewSpellEffectInput } from "./homebrewSpell";
import type { HomebrewSubclassFeatureInput } from "./homebrewSubclass";

/**
 * V3.1-2 — Rouvrir une fiche maison dans son formulaire de creation.
 *
 * Chaque formulaire « Creer un/une… » construit des blocs ; ces fonctions
 * font le chemin inverse, des blocs ecrits vers les valeurs du formulaire.
 * Pures, et testees contre les constructeurs eux-memes : ce qu'un
 * formulaire ecrit, il doit pouvoir le relire a l'identique.
 */

/** Un bloc tel que relu de la fiche : son type et sa donnee brute. */
export interface EditableBlock {
  blockType: string;
  data: unknown;
}

/** Les blocs presents avant et absents de la nouvelle version : a retirer par une surcharge `remove_block`. */
export function blockTypesToRemove(previous: readonly string[], next: readonly string[]): string[] {
  const kept = new Set(next);
  return [...new Set(previous)].filter((blockType) => !kept.has(blockType));
}

function dataOf(blocks: readonly EditableBlock[], blockType: string): unknown {
  return blocks.find((b) => b.blockType === blockType)?.data;
}

function descriptionOf(blocks: readonly EditableBlock[]): { description: string; pageRef: string } {
  const parsed = zDescriptionBlockData.safeParse(dataOf(blocks, "description"));
  if (!parsed.success) return { description: "", pageRef: "" };
  return { description: parsed.data.segments.map((s) => s.text).join("\n\n"), pageRef: parsed.data.page_ref ?? "" };
}

export interface SpellFormValues {
  level: number;
  school: string;
  castingTime: string;
  range: string;
  components: ("V" | "S" | "M")[];
  material: string;
  duration: string;
  concentration: boolean;
  ritual: boolean;
  description: string;
  pageRef: string;
  effect: HomebrewSpellEffectInput | null;
  scaling: { level: number; formula: string }[];
  classKeys: string[];
}

/** Classes autorisees : la ligne `classes` du tableau « Classes et niveau » (`buildHomebrewSpellEntry`). */
function spellClassKeys(blocks: readonly EditableBlock[]): string[] {
  const table = dataOf(blocks, "custom_table") as { rows?: { field?: unknown; value?: unknown }[] } | undefined;
  const raw = table?.rows?.find((r) => r.field === "classes")?.value;
  if (typeof raw !== "string") return [];
  try {
    const list: unknown = JSON.parse(raw);
    return Array.isArray(list) ? list.map((c) => (c as { index?: unknown }).index).filter((k): k is string => typeof k === "string") : [];
  } catch {
    // Une ligne illisible ne bloque pas la modification : le formulaire
    // repart sans classe cochee, et l'auteur les recoche.
    return [];
  }
}

export function spellFormValues(blocks: readonly EditableBlock[]): SpellFormValues {
  const casting = zSpellCastingBlockData.safeParse(dataOf(blocks, "spell_casting"));
  const c = casting.success ? casting.data : null;
  const effects = zEffectsBlockData.safeParse(dataOf(blocks, "effects"));
  const first = effects.success ? effects.data.effects[0] : undefined;

  let effect: HomebrewSpellEffectInput | null = null;
  if (first) {
    effect = {
      kind: first.save ? "save" : first.attack ? "attack" : "none",
      ability: first.save?.ability ?? "dex",
      attackRange: first.attack?.range ?? "ranged",
      formula: first.formula ? formatFormulaNode(first.formula) : "",
      damageType: first.damage_type ?? "fire",
      onSuccess: (first.save?.effect_on_success as HomebrewSpellEffectInput["onSuccess"] | undefined) ?? "half",
    };
  }

  const scalingData = zScalingBlockData.safeParse(dataOf(blocks, "scaling"));
  const scaling =
    scalingData.success && scalingData.data.table
      ? Object.entries(scalingData.data.table)
          .map(([level, formula]) => ({ level: Number(level), formula: String(formula) }))
          .filter((row) => row.level !== scalingData.data.base)
          .sort((a, b) => a.level - b.level)
      : [];

  return {
    level: c?.level ?? 1,
    school: c?.school ?? "Evocation",
    castingTime: c?.casting_time ?? "",
    range: c?.range ?? "",
    components: c?.components ?? [],
    material: c?.material ?? "",
    duration: c?.duration ?? "",
    concentration: c?.concentration ?? false,
    ritual: c?.ritual ?? false,
    ...descriptionOf(blocks),
    effect,
    scaling,
    classKeys: spellClassKeys(blocks),
  };
}

export interface SubclassFormValues {
  description: string;
  pageRef: string;
  features: HomebrewSubclassFeatureInput[];
}

export function subclassFormValues(blocks: readonly EditableBlock[]): SubclassFormValues {
  const features = zSubclassFeaturesBlockData.safeParse(dataOf(blocks, "subclass_features"));
  return {
    ...descriptionOf(blocks),
    features: features.success ? features.data.features.map((f) => ({ name: f.name, level: f.level, description: f.description })) : [],
  };
}

export interface FeatureFormValues {
  description: string;
  prerequisites: string[];
  /** `value` en texte, comme le champ du formulaire ; « 1 » pour un effet sans valeur (avantage, maitrise...). */
  modifiers: { target: string; op: string; value: string }[];
  triggers: Trigger[];
}

export function featureFormValues(blocks: readonly EditableBlock[]): FeatureFormValues {
  const prerequisites = zPrerequisitesBlockData.safeParse(dataOf(blocks, "prerequisites"));
  const modifiers = zModifiersBlockData.safeParse(dataOf(blocks, "modifiers"));
  const triggers = zTriggersBlockData.safeParse(dataOf(blocks, "triggers"));
  return {
    description: descriptionOf(blocks).description,
    prerequisites: prerequisites.success ? prerequisites.data.items : [],
    modifiers: modifiers.success ? modifiers.data.modifiers.map((m) => ({ target: m.target, op: m.op, value: String(m.value ?? 1) })) : [],
    triggers: triggers.success ? triggers.data.triggers : [],
  };
}

export interface BackgroundFormValues {
  description: string;
  abilityScores: string[];
  skillProficiencies: string[];
  toolProficiency: string;
  featKey: string;
  /** Un objet relie a une fiche garde sa cle ; un objet en texte libre garde son libelle (meme lecture que le formulaire a l'envoi). */
  equipmentOptions: { label: string; items: { key: string; quantity: number }[]; gold: string }[];
}

export function backgroundFormValues(blocks: readonly EditableBlock[]): BackgroundFormValues | null {
  const parsed = zBackgroundBlockData.safeParse(dataOf(blocks, "background"));
  if (!parsed.success) return null;
  const b = parsed.data;
  return {
    description: descriptionOf(blocks).description,
    abilityScores: b.ability_scores,
    skillProficiencies: b.skill_proficiencies,
    toolProficiency: b.tool_proficiency ?? "",
    featKey: b.feat.key,
    equipmentOptions: b.equipment_options.map((o) => ({
      label: o.label,
      items: o.items.map((it) => ({ key: it.ref?.key ?? it.label, quantity: it.quantity })),
      gold: o.gold ? String(o.gold.value) : "",
    })),
  };
}

export interface WeaponFormValues {
  description: string;
  category: "simple" | "martial";
  isRanged: boolean;
  diceCount: number;
  diceFaces: number;
  damageType: string;
  versatile: { count: number; faces: number } | null;
  propertyKeys: string[];
  masteryKey: string;
  /** Unites du bloc (pieds, livres) : le formulaire convertit en metres et kilos, comme a l'envoi. */
  rangeFt: { normal: number; long: number | null } | null;
  weightLb: number | null;
  cost: { value: number; unit: string } | null;
}

function diceOf(node: unknown): { count: number; faces: number } | null {
  const n = node as { op?: unknown; count?: unknown; faces?: unknown } | undefined;
  return n?.op === "dice" && typeof n.count === "number" && typeof n.faces === "number" ? { count: n.count, faces: n.faces } : null;
}

export function weaponFormValues(blocks: readonly EditableBlock[]): WeaponFormValues | null {
  const parsed = zWeaponBlockData.safeParse(dataOf(blocks, "weapon"));
  if (!parsed.success) return null;
  const w = parsed.data;
  const dice = diceOf(w.damage.dice) ?? { count: 1, faces: 6 };
  return {
    description: descriptionOf(blocks).description,
    category: w.category,
    isRanged: w.is_ranged,
    diceCount: dice.count,
    diceFaces: dice.faces,
    damageType: w.damage.type ?? "",
    versatile: diceOf(w.versatile_damage),
    propertyKeys: w.properties.map((p) => p.key),
    masteryKey: w.mastery?.key ?? "",
    rangeFt: w.range ? { normal: w.range.normal.value, long: w.range.long?.value ?? null } : null,
    weightLb: w.weight?.value ?? null,
    cost: w.cost ? { value: w.cost.value, unit: w.cost.unit } : null,
  };
}
