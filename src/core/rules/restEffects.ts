import type { RuntimeState } from "../schemas/runtimeState";
import type { ResolvedEffect } from "./triggers";

/**
 * ADR 0050 (V3.1-5) — Ce qu'un repos tire de ses declencheurs.
 *
 * Hors du tour solo, le moteur rend ses effets sans les appliquer. Un repos
 * fait exception : `takeShortRest` / `takeLongRest` emettent leur evenement
 * (ADR 0036 §7) et appliquent ICI les effets rendus, sur l'etat d'apres
 * repos, pour une seule ecriture. Un repos n'a qu'un acteur, `self`.
 *
 * Quatre effets s'appliquent ; tout autre est rendu « ignore » avec sa
 * raison, pour que l'appelant le consigne — jamais perdu en silence.
 */
export interface RestEffectsOptions {
  hpMax: number;
  /** 1 (regle 2024) tant que le reglage de table `inspiration_max` n'existe pas (V3.1-108). */
  inspirationMax: number;
}

export interface RestEffectsResult {
  state: RuntimeState;
  /** Une ligne lisible par effet applique, pour la note du changement. */
  applied: string[];
  ignored: { action: ResolvedEffect["action"]; reason: string }[];
}

const SELF = "self";

export function applyRestEffects(rested: RuntimeState, effects: readonly ResolvedEffect[], opts: RestEffectsOptions): RestEffectsResult {
  let state = rested;
  const applied: string[] = [];
  const ignored: RestEffectsResult["ignored"] = [];

  for (const effect of effects) {
    if ("who" in effect && effect.who !== SELF) {
      ignored.push({ action: effect.action, reason: `Effet visant « ${effect.who} » : un repos n'a que le personnage lui-même.` });
      continue;
    }
    switch (effect.action) {
      case "grant_inspiration": {
        if (state.inspiration >= opts.inspirationMax) {
          ignored.push({ action: effect.action, reason: `Inspiration héroïque déjà au maximum (${opts.inspirationMax}).` });
          break;
        }
        applied.push(`Inspiration héroïque : ${state.inspiration} → ${state.inspiration + 1}`);
        state = { ...state, inspiration: state.inspiration + 1 };
        break;
      }
      case "heal": {
        const to = Math.min(opts.hpMax, state.hp.current + Math.max(0, effect.amount));
        applied.push(`Soins : ${state.hp.current} → ${to} PV`);
        state = { ...state, hp: { ...state.hp, current: to } };
        break;
      }
      case "apply_condition":
      case "remove_condition": {
        const adding = effect.action === "apply_condition";
        if (state.conditions.includes(effect.key) === adding) {
          ignored.push({ action: effect.action, reason: adding ? `Condition « ${effect.key} » déjà présente.` : `Condition « ${effect.key} » absente.` });
          break;
        }
        applied.push(adding ? `Condition posée : ${effect.key}` : `Condition retirée : ${effect.key}`);
        state = { ...state, conditions: adding ? [...state.conditions, effect.key] : state.conditions.filter((c) => c !== effect.key) };
        break;
      }
      default:
        ignored.push({ action: effect.action, reason: `Effet « ${effect.action} » non appliqué par un repos (ADR 0050).` });
    }
  }

  return { state, applied, ignored };
}

/**
 * Emplacements de sort rendus par un repos long. `mergeRuntimeState` fusionne
 * `spell_slots_used` cle par cle : un objet vide ne remet donc rien a zero
 * (bogue releve avec V3.1-5) — chaque niveau consomme doit valoir 0.
 */
export function clearedSpellSlots(used: Readonly<Record<string, number>>): Record<string, number> {
  return Object.fromEntries(Object.keys(used).map((level) => [level, 0]));
}
