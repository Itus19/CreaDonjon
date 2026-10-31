import type { Ability } from "./abilities";
import { SKILL_ABILITIES, spellNumbers, type DerivedSheet, type Skill } from "./sheet";

/**
 * V3.1-50 — Ce qu'un choix donnerait, chiffré par le moteur pour CE
 * personnage : l'écran l'affiche, il ne le calcule jamais.
 */

export interface SpellAbilityEffect {
  ability: Ability;
  mod: number;
  saveDc: number;
  attackBonus: number;
}

/** La caractéristique d'incantation d'un trait ou d'un don : DD et attaque de SES sorts, pour chaque option. */
export function spellAbilityEffects(sheet: DerivedSheet, options: readonly Ability[]): SpellAbilityEffect[] {
  return options.map((ability) => {
    const mod = sheet.abilities[ability].mod;
    return { ability, mod, ...spellNumbers(mod, sheet.proficiencyBonus) };
  });
}

/** L'option à signaler : celle de la classe si elle est proposée, sinon la meilleure (la première en cas d'égalité). */
export function bestSpellAbility(effects: readonly SpellAbilityEffect[], classAbility: Ability | undefined): Ability | null {
  if (classAbility && effects.some((e) => e.ability === classAbility)) return classAbility;
  let best: SpellAbilityEffect | null = null;
  for (const e of effects) if (!best || e.mod > best.mod) best = e;
  return best?.ability ?? null;
}

export interface SkillChoiceEffect {
  skill: Skill;
  current: number;
  /** Le total si ce choix la désigne. Égal à `current` si une autre source la rend déjà maîtrisée. */
  ifChosen: number;
  /** La source qui la rend déjà maîtrisée (hors ce choix) : ce choix ne donnerait rien de plus. */
  alreadyFrom: string | null;
}

/** `ownFeatureKey` : l'aptitude que produit CE choix (`choice:<clé>`) — sa propre maîtrise ne compte pas comme acquise ailleurs. */
export function skillChoiceEffects(sheet: DerivedSheet, skills: readonly Skill[], ownFeatureKey: string): SkillChoiceEffect[] {
  return skills.map((skill) => {
    const result = sheet.skills[skill];
    let alreadyFrom: string | null = null;
    for (const f of sheet.features) {
      if (f.key === ownFeatureKey) continue;
      const m = f.modifiers.find((x) => x.target === `skill.${skill}` && (x.op === "proficiency" || x.op === "expertise"));
      if (m) {
        alreadyFrom = m.label;
        break;
      }
    }
    const ownsIt = sheet.features.some((f) => f.key === ownFeatureKey && f.modifiers.some((x) => x.target === `skill.${skill}`));
    let ifChosen = result.mod;
    if (!alreadyFrom && !ownsIt) {
      // Sans maîtrise : le modificateur de la caractéristique, plus la maîtrise (qui remplace une demi-maîtrise).
      ifChosen = sheet.abilities[SKILL_ABILITIES[skill]].mod + sheet.proficiencyBonus;
    }
    return { skill, current: result.mod, ifChosen, alreadyFrom };
  });
}
