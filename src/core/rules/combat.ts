/**
 * Ordre du tour d'un combat (V1-E4, specs/outils-mj.md §5) : tri par
 * initiative et avancement round/tour. Aucune regle de degagite
 * d'egalite automatique inventee — le SRD laisse ça a l'arbitrage du MJ,
 * le depart age est simplement stable (ordre d'ajout du participant),
 * jamais aleatoire ni recalcule a chaque tri.
 */

import type { Rng } from "../dice/rng";

/** floor((score - 10) / 2) — meme formule que `abilityModifier` prive de sheet.ts, duplique ici a dessein plutot que de faire de src/core/rules/combat.ts un consommateur du module de fiche derivee, sans rapport de domaine avec le suivi d'initiative. */
export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

/** d20 + modificateur de Dexterite — jamais Math.random() (CLAUDE.md regle 6), le RNG est fourni par l'appelant (serverRng cote route). */
export function rollInitiative(dexModifier: number, rng: Rng): number {
  return rng.nextInt(20) + 1 + dexModifier;
}

export class EmptyCombatError extends Error {
  constructor() {
    super("Un combat sans participant n'a pas d'ordre du tour.");
    this.name = "EmptyCombatError";
  }
}

export interface CombatParticipantOrder {
  id: string;
  initiative: number | null;
  displayOrder: number;
}

/** Initiative decroissante ; egalite departagee par `displayOrder` croissant (ordre d'ajout) ; un participant sans initiative lancee va en dernier, dans le meme ordre stable. */
export function sortByInitiative<T extends CombatParticipantOrder>(participants: readonly T[]): T[] {
  return [...participants].sort((a, b) => {
    if (a.initiative === null && b.initiative === null) return a.displayOrder - b.displayOrder;
    if (a.initiative === null) return 1;
    if (b.initiative === null) return -1;
    if (b.initiative !== a.initiative) return b.initiative - a.initiative;
    return a.displayOrder - b.displayOrder;
  });
}

export interface CombatTurnState {
  round: number;
  turnIndex: number;
}

/** Round 1, premier participant de l'ordre trie — l'etat initial au clic sur "Go". */
export function startCombat(participantCount: number): CombatTurnState {
  if (participantCount <= 0) throw new EmptyCombatError();
  return { round: 1, turnIndex: 0 };
}

/** Tour suivant ; boucle sur le premier participant et incremente le round en depassant le dernier. */
export function advanceTurn(state: CombatTurnState, participantCount: number): CombatTurnState {
  if (participantCount <= 0) throw new EmptyCombatError();
  const nextIndex = state.turnIndex + 1;
  if (nextIndex >= participantCount) return { round: state.round + 1, turnIndex: 0 };
  return { round: state.round, turnIndex: nextIndex };
}

/** Tour precedent ; symetrique d'`advanceTurn`. Jamais un round sous 1 (le premier tour du premier round n'a pas de precedent — reste sur place). */
export function retreatTurn(state: CombatTurnState, participantCount: number): CombatTurnState {
  if (participantCount <= 0) throw new EmptyCombatError();
  if (state.turnIndex > 0) return { round: state.round, turnIndex: state.turnIndex - 1 };
  if (state.round <= 1) return state;
  return { round: state.round - 1, turnIndex: participantCount - 1 };
}
