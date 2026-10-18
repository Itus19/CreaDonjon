/**
 * Tables de probabilites de reussite (V1-E5, specs/arbitrage-modifications.md
 * §3.6) : fonction pure sur la fiche derivee, `P(1d20 + mod >= DD)` avec
 * avantage/desavantage. Enumeration brute (20 ou 400 issues) plutot
 * qu'algebre fermee : plus facile a lire et a tester, et le volume reste
 * negligeable (24 lignes par PJ au DD choisi, V3.1-46).
 */

import { ABILITIES, SKILL_ABILITIES, SKILLS, type Ability, type DerivedSheet, type RollState, type Skill, type SkillResult, type Source } from "./sheet";

/** Nombre de faces (1..20) qui atteignent la cible, borne a [0, 20]. */
function probabilityOfSingleD20(modifier: number, dc: number): number {
  const target = dc - modifier;
  const successfulFaces = Math.max(0, Math.min(20, 21 - target));
  return successfulFaces / 20;
}

export function successProbability(modifier: number, dc: number, rollState: RollState): number {
  if (rollState === "normal") {
    return probabilityOfSingleD20(modifier, dc);
  }
  let successes = 0;
  for (let a = 1; a <= 20; a++) {
    for (let b = 1; b <= 20; b++) {
      const roll = rollState === "advantage" ? Math.max(a, b) : Math.min(a, b);
      if (roll + modifier >= dc) successes++;
    }
  }
  return successes / 400;
}

/** V3.1-46 : le DD réglable de la matrice, et ses puces. */
export const PROBABILITY_DC_MIN = 5;
export const PROBABILITY_DC_MAX = 30;
export const PROBABILITY_DC_PRESETS = [10, 15, 20, 25] as const;

/**
 * Une ligne de la matrice des probabilités (V3.1-46) : un jet de
 * caractéristique ou une compétence, tel que la fiche le calcule
 * (`characterSheet`, touche-à-tout et avantage compris). `sources` explique
 * le modificateur (caractéristique, maîtrise ou expertise, touche-à-tout).
 * La probabilité elle-même se calcule au DD choisi, avec `successProbability`.
 */
export interface CheckLine {
  kind: "ability" | "skill";
  key: Ability | Skill;
  /** La caractéristique du jet (pour une compétence : celle qui la gouverne). */
  ability: Ability;
  mod: number;
  proficiency: SkillResult["proficiency"];
  rollState: RollState;
  sources: Source[];
}

/** Les six jets de caractéristique, puis les dix-huit compétences, dans l'ordre de la fiche. */
export function checkLines(sheet: Pick<DerivedSheet, "abilityChecks" | "skills">): CheckLine[] {
  const abilities: CheckLine[] = ABILITIES.map((ability) => {
    const r = sheet.abilityChecks[ability];
    return { kind: "ability", key: ability, ability, mod: r.mod, proficiency: r.halfProficiency ? "half" : "none", rollState: r.rollState, sources: r.sources };
  });
  const skills: CheckLine[] = SKILLS.map((skill) => {
    const r = sheet.skills[skill];
    return { kind: "skill", key: skill, ability: SKILL_ABILITIES[skill], mod: r.mod, proficiency: r.proficiency, rollState: r.rollState, sources: r.sources };
  });
  return [...abilities, ...skills];
}

/**
 * Les colonnes au meilleur d'une ligne (toutes, en cas d'égalité) : la case à
 * encadrer. Une ligne toute à égalité n'a pas de meilleur : rien à encadrer.
 */
export function bestIndices(values: readonly number[]): number[] {
  if (values.length === 0) return [];
  const best = Math.max(...values);
  if (values.every((v) => v === best)) return [];
  return values.flatMap((v, i) => (v === best ? [i] : []));
}
