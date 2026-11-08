import { ABILITIES, BONUS_ACTION_OPTIONS, PASSIVE_SKILLS, SENSES, SKILLS, SPECIAL_SPEEDS, type Ability, type ModifierOp, type Sense, type Skill, type SpecialSpeed } from "./sheet";
import { SPELL_DAMAGE_TYPES } from "./homebrewSpell";

/**
 * Catalogue FERME des cibles qu'un modificateur declare (bloc `modifiers`,
 * specs/regles-blocs.md) peut viser — jamais une chaine libre saisie par
 * l'utilisateur (CLAUDE.md, "l'utilisateur ne voit jamais de JSON"). Chaque
 * entree correspond a une cible reellement lue par `characterSheet()`
 * (src/core/rules/sheet.ts) : proposer une cible ici que le moteur ignore
 * (ex. "initiative", jamais calculee — voir DerivedSheet) serait une
 * promesse non tenue. Pur — aucune etiquette FR ici, elles vivent dans
 * `src/i18n/fr.ts` (CLAUDE.md regle 11) et se composent a l'affichage.
 */
export type ModifierTargetCategory =
  | "ac"
  | "speed"
  | "hp_max"
  | "ability"
  | "save"
  | "skill"
  /** V3.1-155 (ADR 0074) : cibles de jet et cibles nouvelles. */
  | "attack"
  | "damage"
  | "crit"
  | "speed_special"
  | "sense"
  | "prof"
  | "ac_unarmored"
  /** V3.1-178 : une valeur passive seule (Perception, Intuition, Investigation). */
  | "passive"
  /** V3.1-164 (ADR 0076) : attaques par action, actions permises en action bonus. */
  | "attacks"
  | "bonus_action";

export interface ModifierTargetOption {
  target: string;
  category: ModifierTargetCategory;
  ability?: Ability;
  skill?: Skill;
  /** V3.1-155 : arme ou sort, pour une attaque, des dégâts ou une plage de critique. */
  kind?: "weapon" | "spell";
  /** V3.1-155 : type de dégâts (`damage.spell.fire`). */
  damageType?: string;
  speed?: SpecialSpeed;
  sense?: Sense;
}

export const MODIFIER_TARGET_OPTIONS: readonly ModifierTargetOption[] = [
  { target: "ac", category: "ac" },
  { target: "speed", category: "speed" },
  { target: "hp.max", category: "hp_max" },
  ...ABILITIES.map((a): ModifierTargetOption => ({ target: `ability.${a}`, category: "ability", ability: a })),
  ...ABILITIES.map((a): ModifierTargetOption => ({ target: `save.${a}`, category: "save", ability: a })),
  ...SKILLS.map((s): ModifierTargetOption => ({ target: `skill.${s}`, category: "skill", skill: s })),
  // V3.1-155 (ADR 0074) — lues par `characterSheet()` et `rollBonus()`.
  { target: "save", category: "save" },
  { target: "attack", category: "attack" },
  { target: "attack.weapon", category: "attack", kind: "weapon" },
  { target: "attack.spell", category: "attack", kind: "spell" },
  { target: "damage", category: "damage" },
  { target: "damage.weapon", category: "damage", kind: "weapon" },
  { target: "damage.spell", category: "damage", kind: "spell" },
  ...ABILITIES.map((a): ModifierTargetOption => ({ target: `damage.weapon.${a}`, category: "damage", kind: "weapon", ability: a })),
  ...SPELL_DAMAGE_TYPES.map((t): ModifierTargetOption => ({ target: `damage.spell.${t}`, category: "damage", kind: "spell", damageType: t })),
  { target: "crit_range", category: "crit" },
  { target: "crit_range.weapon", category: "crit", kind: "weapon" },
  ...SPECIAL_SPEEDS.map((sp): ModifierTargetOption => ({ target: `speed.${sp}`, category: "speed_special", speed: sp })),
  ...SENSES.map((se): ModifierTargetOption => ({ target: `sense.${se}`, category: "sense", sense: se })),
  { target: "prof.weapon.simple", category: "prof" },
  { target: "prof.weapon.martial", category: "prof" },
  { target: "prof.armor.light", category: "prof" },
  { target: "prof.armor.medium", category: "prof" },
  { target: "prof.armor.heavy", category: "prof" },
  { target: "prof.armor.shield", category: "prof" },
  { target: "ac.unarmored", category: "ac_unarmored" },
  { target: "ac.unarmored_no_shield", category: "ac_unarmored" },
  ...PASSIVE_SKILLS.map((s): ModifierTargetOption => ({ target: `passive.${s}`, category: "passive", skill: s })),
  { target: "attacks_per_action", category: "attacks" },
  ...BONUS_ACTION_OPTIONS.map((a): ModifierTargetOption => ({ target: `action_as_bonus.${a}`, category: "bonus_action" })),
];

/** Effets valides pour une categorie de cible — ex. la maitrise/l'expertise n'ont de sens que sur une sauvegarde ou une competence, jamais sur la CA. */
export const OPS_BY_TARGET_CATEGORY: Record<ModifierTargetCategory, readonly ModifierOp[]> = {
  ac: ["add", "set"],
  speed: ["add", "set"],
  hp_max: ["add", "set"],
  ability: ["add", "set"],
  save: ["add", "proficiency", "advantage", "disadvantage"],
  skill: ["add", "proficiency", "expertise", "advantage", "disadvantage"],
  attack: ["add", "advantage", "disadvantage"],
  damage: ["add"],
  crit: ["set"],
  speed_special: ["add", "set", "max"],
  sense: ["set", "max"],
  prof: ["proficiency"],
  ac_unarmored: ["set"],
  // L'avantage et le désavantage passent par la compétence (`skill.<clé>`), qui les répercute en ±5.
  passive: ["add"],
  attacks: ["set", "max"],
  bonus_action: ["set"],
};

/** `add`/`set`/`min`/`max` portent un montant ; les quatre autres (avantage, desavantage, maitrise, expertise) sont des drapeaux, jamais de valeur associee (meme distinction que `Modifier.value` dans sheet.ts, optionnel). */
export function modifierOpNeedsValue(op: ModifierOp): boolean {
  return op === "add" || op === "set" || op === "min" || op === "max";
}

export function modifierTargetOption(target: string): ModifierTargetOption | undefined {
  return MODIFIER_TARGET_OPTIONS.find((o) => o.target === target);
}
