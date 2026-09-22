import { z } from "zod";
import { grantToBudget, zActionBudget, type ActionBudget, type BudgetKind } from "./actionBudget";
import { moveToZone, sceneZoneOf, type SceneState } from "./scene";
import type { ResolvedEffect, TriggerZone } from "./triggers";

/**
 * V3-B2 — Appliquer ce que le moteur PROPOSE.
 *
 * Depuis V3-A1, les declencheurs rendent des `ResolvedEffect` : des faits
 * deja calcules, que personne n'appliquait. Le backlog le disait sans
 * detour — « une regle maison se saisit, se relit et part, sans rien
 * changer a la partie ». Ce module est ce qui manquait.
 *
 * Module PUR, et c'est ce qui le rend testable en millisecondes : il prend
 * un etat de tour, rend un NOUVEL etat plus la liste de ce qui a change.
 * Rien n'est mute sur place — annuler un tour (V3-F2) restaurera un etat
 * entier, et comparer avant/apres doit rester possible.
 *
 * Deux principes, tous deux issus de tickets precedents :
 *
 * 1. **Un effet impossible est CONSIGNE, jamais tu, jamais levé.** Une
 *    regle maison qui vise un absent, ou qui demande une capacite que le
 *    moteur n'a pas, ne doit ni figer une partie en cours ni se faire
 *    passer pour appliquee. Meme discipline que `runTriggers`, qui garde
 *    ses `failures` au lieu d'interrompre.
 * 2. **Signaler, ne pas interdire** (V3-A3) : un budget depasse descend en
 *    negatif et le dit. Aucun effet n'est refuse parce qu'il « ne devrait
 *    pas ».
 */

export interface ActorHp {
  current: number;
  max: number;
  temp: number;
}

export interface TurnActor {
  hp: ActorHp;
  conditions: string[];
  /** Compteurs nommes (emplacements, charges) — `spend_resource` les entame. */
  resources: Record<string, number>;
  budget: ActionBudget;
}

export interface TurnState {
  scene: SceneState;
  /** Indexe par identifiant d'acteur — les memes cles que `TriggerContext.actors`. */
  actors: Record<string, TurnActor>;
}

export const zActorHp = z.object({
  current: z.number().int(),
  max: z.number().int().nonnegative(),
  temp: z.number().int().nonnegative(),
});

export const zTurnActor = z.object({
  hp: zActorHp,
  conditions: z.array(z.string().min(1)),
  resources: z.record(z.string(), z.number()),
  budget: zActionBudget,
});

export type TurnChange =
  | { kind: "hp"; who: string; from: ActorHp; to: ActorHp; note: string }
  | { kind: "condition"; who: string; key: string; added: boolean }
  | { kind: "zone"; who: string; from: TriggerZone; to: TriggerZone }
  | { kind: "budget"; who: string; budget: BudgetKind; from: number; to: number; overBudget: boolean }
  | { kind: "resource"; who: string; key: string; from: number; to: number }
  | { kind: "roll"; label: string; value: number; note?: string }
  | { kind: "hint"; text: string }
  | { kind: "ignored"; action: ResolvedEffect["action"]; who?: string; reason: string };

export interface ApplyResult {
  state: TurnState;
  /** Dans l'ordre d'application — c'est le recit mecanique du tour, et ce que le journal consigne. */
  changes: TurnChange[];
}

function withActor(state: TurnState, who: string, next: TurnActor): TurnState {
  return { ...state, actors: { ...state.actors, [who]: next } };
}

/**
 * Les degats entament les points de vie TEMPORAIRES en premier (regle
 * standard), puis les courants, et s'arretent a zero. Zero n'est pas la
 * mort : c'est l'inconscience et les jets de sauvegarde contre la mort, que
 * ce module ne simule pas — il rend l'etat, l'appelant en tire ce qu'il
 * veut.
 */
function applyDamage(hp: ActorHp, amount: number): ActorHp {
  const absorbed = Math.min(hp.temp, amount);
  const rest = amount - absorbed;
  return { ...hp, temp: hp.temp - absorbed, current: Math.max(0, hp.current - rest) };
}

export function applyEffects(state: TurnState, effects: readonly ResolvedEffect[]): ApplyResult {
  const changes: TurnChange[] = [];
  let next = state;

  const missing = (effect: ResolvedEffect, who: string): void => {
    changes.push({
      kind: "ignored",
      action: effect.action,
      who,
      reason: `Acteur "${who}" absent du tour : l'effet n'a pas ete applique.`,
    });
  };

  for (const effect of effects) {
    switch (effect.action) {
      case "deal_damage":
      case "heal": {
        const actor = next.actors[effect.who];
        if (!actor) {
          missing(effect, effect.who);
          break;
        }
        const from = actor.hp;
        const to =
          effect.action === "deal_damage"
            ? applyDamage(from, effect.amount)
            : { ...from, current: Math.min(from.max, from.current + effect.amount) };
        const note =
          effect.action === "deal_damage"
            ? `Dégâts : ${effect.amount}${effect.damage_type ? ` (${effect.damage_type})` : ""}`
            : `Soins : ${effect.amount}`;
        next = withActor(next, effect.who, { ...actor, hp: to });
        changes.push({ kind: "hp", who: effect.who, from, to, note });
        break;
      }

      case "apply_condition":
      case "remove_condition": {
        const actor = next.actors[effect.who];
        if (!actor) {
          missing(effect, effect.who);
          break;
        }
        const has = actor.conditions.includes(effect.key);
        const adding = effect.action === "apply_condition";
        if (adding === has) {
          changes.push({
            kind: "ignored",
            action: effect.action,
            who: effect.who,
            reason: adding ? `Condition "${effect.key}" deja presente.` : `Condition "${effect.key}" absente.`,
          });
          break;
        }
        const conditions = adding
          ? [...actor.conditions, effect.key]
          : actor.conditions.filter((c) => c !== effect.key);
        next = withActor(next, effect.who, { ...actor, conditions });
        changes.push({ kind: "condition", who: effect.who, key: effect.key, added: adding });
        break;
      }

      case "move": {
        const from = sceneZoneOf(next.scene, effect.who);
        if (from === undefined) {
          missing(effect, effect.who);
          break;
        }
        if (from === effect.zone) break;
        next = { ...next, scene: moveToZone(next.scene, effect.who, effect.zone) };
        changes.push({ kind: "zone", who: effect.who, from, to: effect.zone });
        break;
      }

      case "grant_budget": {
        const actor = next.actors[effect.who];
        if (!actor) {
          missing(effect, effect.who);
          break;
        }
        const budget = grantToBudget(actor.budget, effect.kind, effect.amount);
        next = withActor(next, effect.who, { ...actor, budget });
        changes.push({
          kind: "budget",
          who: effect.who,
          budget: effect.kind,
          from: actor.budget[effect.kind],
          to: budget[effect.kind],
          overBudget: budget[effect.kind] < 0,
        });
        break;
      }

      case "spend_resource": {
        const actor = next.actors[effect.who];
        if (!actor) {
          missing(effect, effect.who);
          break;
        }
        const from = actor.resources[effect.key] ?? 0;
        const to = from - effect.amount;
        next = withActor(next, effect.who, { ...actor, resources: { ...actor.resources, [effect.key]: to } });
        changes.push({ kind: "resource", who: effect.who, key: effect.key, from, to });
        break;
      }

      case "roll":
        changes.push({ kind: "roll", label: effect.label, value: effect.value });
        break;

      case "saving_throw":
        // Deja resolu par le moteur (le de est tombe la-bas, jamais ici) :
        // il ne reste qu'a le RAPPORTER. Ses suites, `on_fail`/`on_pass`,
        // sont arrivees dans cette meme liste, resolues elles aussi.
        changes.push({
          kind: "roll",
          label: `Sauvegarde ${effect.ability.toUpperCase()} contre DD ${effect.dc}`,
          value: effect.total,
          note: effect.passed ? "réussie" : "échouée",
        });
        break;

      case "narrate_hint":
        changes.push({ kind: "hint", text: effect.text });
        break;

      case "apply_modifier":
        // V3-A6 a compte ce manque parmi les cinq : un effet QUI DURE n'a
        // aucune ecriture — `entity_active_effects` existe depuis la Phase 0
        // et n'est jamais ecrite. L'appliquer « pour ce tour » serait pire
        // que de ne rien faire : un bonus qui disparait sans raison.
        changes.push({
          kind: "ignored",
          action: effect.action,
          who: effect.who,
          reason: `Modificateur "${effect.modifier.label}" non applique : le moteur n'a pas encore d'effet qui dure (V3-A6).`,
        });
        break;
    }
  }

  return { state: next, changes };
}
