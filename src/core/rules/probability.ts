/**
 * Tables de probabilites de reussite (V1-E5, specs/arbitrage-modifications.md
 * §3.6) : fonction pure sur la fiche derivee, `P(1d20 + mod >= DD)` avec
 * avantage/desavantage. Enumeration brute (20 ou 400 issues) plutot
 * qu'algebre fermee : plus facile a lire et a tester, et le volume reste
 * negligeable (18 competences x 3 DD par PJ, jamais recalcule en boucle
 * serree).
 */

import { SKILLS, type DerivedSheet, type RollState, type Skill } from "./sheet";

export const DEFAULT_PROBABILITY_DCS = [10, 15, 20] as const;

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

export interface SkillProbabilityRow {
  skill: Skill;
  mod: number;
  rollState: RollState;
  probabilities: Record<number, number>;
}

export function skillProbabilityTable(
  sheet: Pick<DerivedSheet, "skills">,
  dcs: readonly number[] = DEFAULT_PROBABILITY_DCS
): SkillProbabilityRow[] {
  return SKILLS.map((skill) => {
    const result = sheet.skills[skill];
    const probabilities: Record<number, number> = {};
    for (const dc of dcs) probabilities[dc] = successProbability(result.mod, dc, result.rollState);
    return { skill, mod: result.mod, rollState: result.rollState, probabilities };
  });
}
