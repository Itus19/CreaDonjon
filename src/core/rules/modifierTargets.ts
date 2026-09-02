import { ABILITIES, SKILLS, type Ability, type ModifierOp, type Skill } from "./sheet";

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
export type ModifierTargetCategory = "ac" | "speed" | "hp_max" | "ability" | "save" | "skill";

export interface ModifierTargetOption {
  target: string;
  category: ModifierTargetCategory;
  ability?: Ability;
  skill?: Skill;
}

export const MODIFIER_TARGET_OPTIONS: readonly ModifierTargetOption[] = [
  { target: "ac", category: "ac" },
  { target: "speed", category: "speed" },
  { target: "hp.max", category: "hp_max" },
  ...ABILITIES.map((a): ModifierTargetOption => ({ target: `ability.${a}`, category: "ability", ability: a })),
  ...ABILITIES.map((a): ModifierTargetOption => ({ target: `save.${a}`, category: "save", ability: a })),
  ...SKILLS.map((s): ModifierTargetOption => ({ target: `skill.${s}`, category: "skill", skill: s })),
];

/** Effets valides pour une categorie de cible — ex. la maitrise/l'expertise n'ont de sens que sur une sauvegarde ou une competence, jamais sur la CA. */
export const OPS_BY_TARGET_CATEGORY: Record<ModifierTargetCategory, readonly ModifierOp[]> = {
  ac: ["add", "set"],
  speed: ["add", "set"],
  hp_max: ["add", "set"],
  ability: ["add", "set"],
  save: ["add", "proficiency", "advantage", "disadvantage"],
  skill: ["add", "proficiency", "expertise", "advantage", "disadvantage"],
};

/** `add`/`set`/`min`/`max` portent un montant ; les quatre autres (avantage, desavantage, maitrise, expertise) sont des drapeaux, jamais de valeur associee (meme distinction que `Modifier.value` dans sheet.ts, optionnel). */
export function modifierOpNeedsValue(op: ModifierOp): boolean {
  return op === "add" || op === "set" || op === "min" || op === "max";
}

export function modifierTargetOption(target: string): ModifierTargetOption | undefined {
  return MODIFIER_TARGET_OPTIONS.find((o) => o.target === target);
}
