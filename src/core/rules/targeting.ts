import { abilityModifier, advanceTurn, retreatTurn, type CombatTurnState } from "./combat";

/**
 * V3.1-105 (ADR 0042) — les décisions du cœur de résolution, sans base ni dé.
 * Le service `targetedRoll.ts` lance (règle 8), ce module tranche.
 */

export type AttackVerdict = "hit" | "miss";

/**
 * Règles 2024 : le total contre la CA, mais un 20 naturel touche toujours et
 * un 1 naturel rate toujours. Sans CA connue, aucun verdict n'est inventé :
 * la table tranche.
 */
export function attackVerdict(
  roll: { total: number; isCritical: boolean; isCriticalFail: boolean },
  ac: number | null
): AttackVerdict | null {
  if (ac === null) return null;
  if (roll.isCritical) return "hit";
  if (roll.isCriticalFail) return "miss";
  return roll.total >= ac ? "hit" : "miss";
}

/** Ce que le bloc `effects` d'un sort dit d'une sauvegarde réussie (« half », « Moitié des dégâts »…). */
function halvesOnSuccess(effectOnSuccess: string | undefined): boolean {
  return effectOnSuccess !== undefined && /half|moiti/i.test(effectOnSuccess);
}

/** Dégâts d'un sort à sauvegarde : tous sur un échec ; la moitié (arrondie à l'inférieur) ou rien sur une réussite. */
export function damageAfterSave(total: number, passed: boolean, effectOnSuccess: string | undefined): number {
  if (!passed) return total;
  return halvesOnSuccess(effectOnSuccess) ? Math.floor(total / 2) : 0;
}

/** Bonus de sauvegarde d'une créature : la sauvegarde maîtrisée de son bloc, sinon le modificateur de la caractéristique. */
export function monsterSaveBonus(
  block: { abilities: Record<string, number>; saving_throws?: { ability: string; bonus: number }[] },
  ability: string
): number {
  const key = ability.toLowerCase();
  const proficient = block.saving_throws?.find((s) => s.ability.toLowerCase() === key);
  if (proficient) return proficient.bonus;
  const score = block.abilities[key];
  return typeof score === "number" ? abilityModifier(score) : 0;
}

/**
 * Hors de l'initiative : une créature (pas un PJ) tombée à 0 PV. Rien n'est
 * stocké (règle 16) : elle reste dans la liste, le MJ peut la soigner, et le
 * passage de tour la saute. Un PJ à 0 PV garde son tour (jets contre la mort).
 */
export function isOutOfFight(participant: { isPc: boolean; hpCurrent: number | null; hpMax: number | null }): boolean {
  if (participant.isPc || participant.hpCurrent === null || participant.hpMax === null) return false;
  return participant.hpCurrent <= 0;
}

/** Applique `step` jusqu'à tomber sur un participant encore en combat ; tout le monde hors de combat : un seul pas, comme avant. */
function stepSkipping(
  state: CombatTurnState,
  out: readonly boolean[],
  step: (s: CombatTurnState, count: number) => CombatTurnState
): CombatTurnState {
  const count = out.length;
  const first = step(state, count);
  if (out.every(Boolean)) return first;
  let next = first;
  for (let guard = 0; guard < count && out[next.turnIndex]; guard++) {
    const moved = step(next, count);
    if (moved.round === next.round && moved.turnIndex === next.turnIndex) break; // début du combat : on ne recule plus
    next = moved;
  }
  return next;
}

/** Tour suivant dans l'ordre trié, en sautant les créatures hors de combat (`out[i]` pour le i-ème de l'ordre). */
export function advanceTurnSkipping(state: CombatTurnState, out: readonly boolean[]): CombatTurnState {
  return stepSkipping(state, out, advanceTurn);
}

/** Tour précédent, même saut. */
export function retreatTurnSkipping(state: CombatTurnState, out: readonly boolean[]): CombatTurnState {
  return stepSkipping(state, out, retreatTurn);
}
