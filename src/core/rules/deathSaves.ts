import { applyDamageToHp, type HpPool } from "./tempHp";

/**
 * Jets contre la mort, regles 2024 (V3.1-24, ADR 0036 §8). Fonctions pures :
 * le de d20 est fourni par l'appelant (lance par le serveur, jamais ici), et
 * rien n'est stocke en plus. « Stabilise » et « mort » se LISENT dans
 * `death_saves` (3 reussites, 3 echecs) — aucun champ supplementaire.
 */

/** Cle de l'etat Inconscient dans `conditions` (meme forme que `prone`, `concentrating`). */
export const UNCONSCIOUS = "unconscious";

export interface DeathSaves {
  success: number;
  fail: number;
}

/** Ce que les regles lisent et modifient : PV, conditions, jets. */
export interface DeathState {
  hp: HpPool;
  conditions: string[];
  deathSaves: DeathSaves;
}

const THRESHOLD = 3;

export function isDead(state: DeathState): boolean {
  return state.deathSaves.fail >= THRESHOLD;
}

/** Stabilise : trois reussites, a 0 PV, sans etre mort. */
export function isStabilized(state: DeathState): boolean {
  return state.deathSaves.success >= THRESHOLD && !isDead(state);
}

function withCondition(conditions: string[], key: string): string[] {
  return conditions.includes(key) ? conditions : [...conditions, key];
}
function withoutCondition(conditions: string[], key: string): string[] {
  return conditions.includes(key) ? conditions.filter((c) => c !== key) : conditions;
}
function addFails(saves: DeathSaves, count: number): DeathSaves {
  return { ...saves, fail: Math.min(THRESHOLD, saves.fail + count) };
}

/**
 * Applique des degats a un personnage.
 *
 * - Les PV temporaires partent d'abord (`applyDamageToHp`).
 * - Qui tombe a 0 PV devient Inconscient ; si les degats restants atteignent
 *   les PV max, c'est la mort directe.
 * - Qui subit des degats a 0 PV encaisse un echec (deux sur un critique),
 *   ou meurt si ces degats atteignent les PV max. Des degats entierement
 *   absorbes par des PV temporaires ne comptent pas. Un personnage stabilise
 *   qui est frappe doit reprendre ses jets : ses reussites repartent a zero.
 */
export function applyDamageWithDeath(state: DeathState, amount: number, options: { critical?: boolean } = {}): DeathState {
  if (amount <= 0 || isDead(state)) return state;
  const wasDown = state.hp.current === 0;
  const { hp, excess } = applyDamageToHp(state.hp, amount);

  if (!wasDown) {
    if (hp.current > 0) return { ...state, hp };
    const dead = excess >= hp.max;
    return {
      hp,
      conditions: withCondition(state.conditions, UNCONSCIOUS),
      deathSaves: dead ? { success: 0, fail: THRESHOLD } : { success: 0, fail: 0 },
    };
  }

  // Deja a 0 PV : rien n'a ete subi si les temporaires ont tout absorbe.
  if (hp.temp > 0 || excess === 0) return { ...state, hp };
  if (excess >= hp.max) return { ...state, hp, deathSaves: { success: 0, fail: THRESHOLD } };
  const base = isStabilized(state) ? { success: 0, fail: state.deathSaves.fail } : state.deathSaves;
  return { ...state, hp, deathSaves: addFails(base, options.critical ? 2 : 1) };
}

/**
 * Un jet contre la mort (`d20` brut, 1 a 20). 10 ou plus reussit ; moins
 * echoue ; 1 compte deux echecs ; 20 rend 1 PV, remet les jets a zero et
 * retire Inconscient. Sans effet hors d'un personnage a 0 PV encore en jeu
 * (ni vivant, ni stabilise, ni mort).
 */
export function rollDeathSave(state: DeathState, d20: number): DeathState {
  if (state.hp.current > 0 || isDead(state) || isStabilized(state)) return state;
  if (d20 >= 20) {
    return {
      hp: { ...state.hp, current: 1 },
      conditions: withoutCondition(state.conditions, UNCONSCIOUS),
      deathSaves: { success: 0, fail: 0 },
    };
  }
  if (d20 <= 1) return { ...state, deathSaves: addFails(state.deathSaves, 2) };
  if (d20 >= 10) return { ...state, deathSaves: { ...state.deathSaves, success: Math.min(THRESHOLD, state.deathSaves.success + 1) } };
  return { ...state, deathSaves: addFails(state.deathSaves, 1) };
}

/**
 * Soin : remet les jets a zero et, pour qui etait a 0 PV, retire Inconscient.
 * Un Inconscient d'une autre source (sommeil) sur qui a des PV reste en place.
 * Les PV ne depassent pas le maximum. Un mort n'est pas soigne : seule une
 * magie de resurrection le ramene, et un repos long, qui passe aussi par ici,
 * ne le releve pas.
 */
export function applyHealing(state: DeathState, amount: number): DeathState {
  if (amount <= 0 || isDead(state)) return state;
  const wasDown = state.hp.current === 0;
  return {
    hp: { ...state.hp, current: Math.min(state.hp.max, state.hp.current + amount) },
    conditions: wasDown ? withoutCondition(state.conditions, UNCONSCIOUS) : state.conditions,
    deathSaves: { success: 0, fail: 0 },
  };
}
