import type { DiceGroup } from "./parseRollDetail";

/**
 * Statistiques de jets (retour utilisateur, ecran d'accueil joueur : "valeur
 * moyenne, nombre de 20 naturel, nombre de 1 naturel, nombre de reussite,
 * nombre d'echec") — bornees aux jets de verification (au moins un d20),
 * jamais un jet de degats pur (`2d6+3`) qui n'a pas de sens pour "20/1
 * naturel" ni "reussite/echec".
 */

export interface DiceStatsInput {
  result: number;
  diceGroups: DiceGroup[];
  verdict: "success" | "fail" | null;
}

export interface DiceStats {
  totalChecks: number;
  averageTotal: number | null;
  natural20Count: number;
  natural1Count: number;
  successCount: number;
  failCount: number;
}

function isCheck(roll: DiceStatsInput): boolean {
  return roll.diceGroups.some((g) => g.faces === 20);
}

/** Avec avantage/desavantage (kh1/kl1), la trace porte les DEUX d20 lances — un "naturel" compte des que l'un d'eux affiche la valeur, jamais seulement le de finalement garde. */
function hasD20Value(roll: DiceStatsInput, value: number): boolean {
  return roll.diceGroups.some((g) => g.faces === 20 && g.rolls.includes(value));
}

export function computeDiceStats(rolls: DiceStatsInput[]): DiceStats {
  const checks = rolls.filter(isCheck);
  const averageTotal = checks.length > 0 ? checks.reduce((sum, r) => sum + r.result, 0) / checks.length : null;
  return {
    totalChecks: checks.length,
    averageTotal,
    natural20Count: checks.filter((r) => hasD20Value(r, 20)).length,
    natural1Count: checks.filter((r) => hasD20Value(r, 1)).length,
    successCount: checks.filter((r) => r.verdict === "success").length,
    failCount: checks.filter((r) => r.verdict === "fail").length,
  };
}
