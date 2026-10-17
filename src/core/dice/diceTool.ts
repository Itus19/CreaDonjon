import { DIE_TYPES, type DieType } from "./roll";
import type { TraceStep } from "../formula/evaluate";
import type { AdvantageState } from "../rules/action";

/**
 * L'outil de dés unique (V3.1-33, ADR 0035) : ce que le serveur lance pour
 * un jet libre, et ce que l'écran lit de la trace qu'il renvoie. Aucun
 * nombre aléatoire ici : la formule part au moteur de formules, côté serveur.
 */

export type DicePool = Partial<Record<DieType, number>>;

export type ToolFormulaResult =
  | { ok: true; formula: string }
  | { ok: false; reason: "empty_pool" | "advantage_needs_one_d20" };

/**
 * « 1d20+2d6+3 ». Le d20 d'abord : avec avantage ou désavantage, il devient
 * `2d20kh1` / `2d20kl1` — ce qui n'a de sens qu'avec UN d20 dans la réserve.
 */
export function buildToolFormula(input: { pool: DicePool; modifier: number; advantage: AdvantageState }): ToolFormulaResult {
  const count = (type: DieType) => input.pool[type] ?? 0;
  if (DIE_TYPES.every((type) => count(type) <= 0)) return { ok: false, reason: "empty_pool" };
  if (input.advantage !== "normal" && count("d20") !== 1) return { ok: false, reason: "advantage_needs_one_d20" };

  const parts: string[] = [];
  if (count("d20") > 0) {
    parts.push(input.advantage === "advantage" ? "2d20kh1" : input.advantage === "disadvantage" ? "2d20kl1" : `${count("d20")}d20`);
  }
  for (const type of DIE_TYPES) {
    if (type !== "d20" && count(type) > 0) parts.push(`${count(type)}${type}`);
  }
  let formula = parts.join("+");
  if (input.modifier > 0) formula += `+${input.modifier}`;
  if (input.modifier < 0) formula += `${input.modifier}`;
  return { ok: true, formula };
}

export interface AdvantagePair {
  mode: "advantage" | "disadvantage";
  rolls: [number, number];
  /** L'indice du dé gardé dans `rolls` (le premier en cas d'égalité). */
  keptIndex: 0 | 1;
}

const PAIR_STEP = /^2d20k([hl])1 \((\d+), (\d+)\)/;

/** Les deux d20 d'un jet avec avantage ou désavantage, lus dans la trace du serveur ; `null` sinon. */
export function advantagePairFromTrace(trace: readonly TraceStep[] | undefined): AdvantagePair | null {
  if (!trace) return null;
  for (const step of trace) {
    const m = PAIR_STEP.exec(step.text);
    if (!m) continue;
    const a = Number(m[2]);
    const b = Number(m[3]);
    const mode = m[1] === "h" ? "advantage" : "disadvantage";
    const keptIndex = (mode === "advantage" ? b > a : b < a) ? 1 : 0;
    return { mode, rolls: [a, b], keptIndex };
  }
  return null;
}

/** Réussite ou échec : seulement contre un DD, et seulement pour un test (un d20 dans le jet). */
export function toolVerdict(input: { total: number; dc: number | null; hasD20: boolean }): "success" | "fail" | null {
  if (input.dc === null || !input.hasD20) return null;
  return input.total >= input.dc ? "success" : "fail";
}

/** La couleur du verdict à l'écran : l'or d'une réussite sur un 20 naturel, sinon vert ou rouge. */
export function verdictTone(verdict: "success" | "fail" | null, naturalD20: number | undefined): "success" | "fail" | "critical" | null {
  if (verdict === null) return null;
  if (verdict === "success" && naturalD20 === 20) return "critical";
  return verdict;
}
