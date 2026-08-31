import type { Rng } from "./rng";

/** Types de des standards (V2-M11, volet de lancer) — source unique pour le picker client et la validation serveur du jet libre, jamais duplique. */
export const DIE_TYPES = ["d4", "d6", "d8", "d10", "d12", "d20", "d100"] as const;
export type DieType = (typeof DIE_TYPES)[number];

export interface DiceKeep {
  mode: "kh" | "kl";
  count: number;
}

export interface DiceRollResult {
  rolls: number[];
  keptRolls: number[];
  total: number;
}

function applyKeep(rolls: number[], keep?: DiceKeep): number[] {
  if (!keep) return rolls;
  const sorted = [...rolls].sort((a, b) => (keep.mode === "kh" ? b - a : a - b));
  return sorted.slice(0, keep.count);
}

/** Lance `count` des a `faces` faces via le RNG fourni, applique le kh/kl eventuel. */
export function rollDice(count: number, faces: number, rng: Rng, keep?: DiceKeep): DiceRollResult {
  const rolls: number[] = [];
  for (let i = 0; i < count; i++) {
    rolls.push(rng.nextInt(faces) + 1);
  }
  const keptRolls = applyKeep(rolls, keep);
  const total = keptRolls.reduce((sum, r) => sum + r, 0);
  return { rolls, keptRolls, total };
}

/**
 * Resultat "extreme" (tous les des au minimum ou au maximum), utilise par
 * les modes d'evaluation `min`/`max` : jamais de RNG consomme.
 */
export function extremeDice(count: number, faces: number, extreme: "min" | "max", keep?: DiceKeep): DiceRollResult {
  const value = extreme === "min" ? 1 : faces;
  const rolls = Array(count).fill(value) as number[];
  const keptRolls = applyKeep(rolls, keep);
  const total = keptRolls.reduce((sum, r) => sum + r, 0);
  return { rolls, keptRolls, total };
}

/**
 * Moyenne analytique, sans RNG. Pour `kh`/`kl`, approximation documentee :
 * la moyenne exacte d'une statistique d'ordre demanderait un calcul
 * combinatoire hors du perimetre de ce ticket ; on retient
 * `count_garde * moyenne_d_un_de`, suffisant pour un affichage "~X".
 */
export function averageDiceValue(count: number, faces: number, keep?: DiceKeep): number {
  const dieAverage = (faces + 1) / 2;
  if (!keep) return count * dieAverage;
  return keep.count * dieAverage;
}
