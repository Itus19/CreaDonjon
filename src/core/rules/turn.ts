import { z } from "zod";
import { grantToBudget, zActionBudget, type ActionBudget, type BudgetKind } from "./actionBudget";
import { moveToZone, sceneZoneOf, type SceneState } from "./scene";
import type { ResolvedEffect, TriggerZone } from "./triggers";
import { applyDamageToHp } from "./tempHp";
import { applyDamageWithDeath, applyHealing, type DeathSaves } from "./deathSaves";

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
  /**
   * V3.1-24 (ADR 0036 §8) — present pour un personnage joueur seulement : ses
   * degats et soins suivent alors les regles des jets contre la mort
   * (Inconscient a 0 PV, mort directe, echecs). Absent (monstre, participant) :
   * les PV tombent a zero sans autre suite, comme avant.
   */
  deathSaves?: DeathSaves;
  /** V3.1-168 (ADR 0077) : résistances, vulnérabilités, immunités aux types de dégâts ; appliquées d'office à un dégât typé. */
  defenses?: { resist: readonly string[]; vulnerable: readonly string[]; immune: readonly string[] };
}

/**
 * V3.1-168 (ADR 0077) — un dégât TYPÉ face aux défenses de sa cible :
 * immunité 0 ; résistance ½ (arrondi à l'inférieur) ; vulnérabilité ×2 ;
 * résistance et vulnérabilité s'annulent. Un dégât sans type n'est jamais
 * modifié : on ne devine pas son type.
 */
export function adjustDamage(
  amount: number,
  type: string | undefined,
  defenses: TurnActor["defenses"] | undefined
): { amount: number; reason: "resist" | "vulnerable" | "immune" | null } {
  if (!type || !defenses) return { amount, reason: null };
  const t = type.toLowerCase();
  if (defenses.immune.includes(t)) return { amount: 0, reason: "immune" };
  const resiste = defenses.resist.includes(t);
  const vulnerable = defenses.vulnerable.includes(t);
  if (resiste && !vulnerable) return { amount: Math.floor(amount / 2), reason: "resist" };
  if (vulnerable && !resiste) return { amount: amount * 2, reason: "vulnerable" };
  return { amount, reason: null };
}

/** Les treize types de dégâts, et leurs noms du SRD français. */
const TYPES_DE_DEGATS: Record<string, string> = {
  acid: "acid", acide: "acid",
  bludgeoning: "bludgeoning", contondant: "bludgeoning",
  cold: "cold", froid: "cold",
  fire: "fire", feu: "fire",
  force: "force",
  lightning: "lightning", foudre: "lightning",
  necrotic: "necrotic", "nécrotique": "necrotic", necrotique: "necrotic",
  piercing: "piercing", perforant: "piercing",
  poison: "poison",
  psychic: "psychic", psychique: "psychic",
  radiant: "radiant",
  slashing: "slashing", tranchant: "slashing",
  thunder: "thunder", tonnerre: "thunder",
};

/**
 * V3.1-169 (ADR 0077) — les défenses d'un bloc de stats (règle ou wiki), en
 * clés de types. Seul un type nommé seul compte : « contondant, perforant et
 * tranchant d'attaques non magiques » est conditionnel, le moteur ne le
 * devine pas (le MJ tranche).
 */
export function defensesFromStatBlock(lists: {
  damage_resistances?: readonly string[];
  damage_vulnerabilities?: readonly string[];
  damage_immunities?: readonly string[];
}): NonNullable<TurnActor["defenses"]> {
  const lire = (l: readonly string[] | undefined) =>
    [...new Set((l ?? []).map((v) => TYPES_DE_DEGATS[v.trim().toLowerCase()]).filter((t): t is string => t !== undefined))].sort();
  return { resist: lire(lists.damage_resistances), vulnerable: lire(lists.damage_vulnerabilities), immune: lire(lists.damage_immunities) };
}

const RAISON_FR = { resist: "résiste", vulnerable: "est vulnérable", immune: "est immunisé" } as const;

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
  deathSaves: z.object({ success: z.number().int().min(0).max(3), fail: z.number().int().min(0).max(3) }).optional(),
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
 * standard, `applyDamageToHp`), puis les courants, et s'arretent a zero. Pour
 * un acteur qui porte des `deathSaves` (un PJ), le passage a zero suit les
 * regles 2024 de `deathSaves.ts` ; sinon c'est tout ce que ce module simule.
 */
function damageActor(actor: TurnActor, amount: number, critical = false): TurnActor {
  if (actor.deathSaves) {
    const out = applyDamageWithDeath({ hp: actor.hp, conditions: actor.conditions, deathSaves: actor.deathSaves }, amount, { critical });
    return { ...actor, hp: out.hp, conditions: out.conditions, deathSaves: out.deathSaves };
  }
  return { ...actor, hp: applyDamageToHp(actor.hp, amount).hp };
}

function healActor(actor: TurnActor, amount: number): TurnActor {
  if (actor.deathSaves) {
    const out = applyHealing({ hp: actor.hp, conditions: actor.conditions, deathSaves: actor.deathSaves }, amount);
    return { ...actor, hp: out.hp, conditions: out.conditions, deathSaves: out.deathSaves };
  }
  return { ...actor, hp: { ...actor.hp, current: Math.min(actor.hp.max, actor.hp.current + amount) } };
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
        // V3.1-168 : les défenses de la cible, d'office, sur un dégât typé.
        const ajuste = effect.action === "deal_damage" ? adjustDamage(effect.amount, effect.damage_type, actor.defenses) : { amount: effect.amount, reason: null };
        const updated =
          effect.action === "deal_damage" ? damageActor(actor, ajuste.amount, effect.critical === true) : healActor(actor, effect.amount);
        const to = updated.hp;
        const note =
          effect.action === "deal_damage"
            ? `Dégâts : ${ajuste.reason ? `${effect.amount} → ${ajuste.amount}, ${RAISON_FR[ajuste.reason]} (${effect.damage_type})` : `${effect.amount}${effect.damage_type ? ` (${effect.damage_type})` : ""}`}`
            : `Soins : ${effect.amount}`;
        next = withActor(next, effect.who, updated);
        changes.push({ kind: "hp", who: effect.who, from, to, note });
        for (const key of updated.conditions.filter((c) => !actor.conditions.includes(c))) {
          changes.push({ kind: "condition", who: effect.who, key, added: true });
        }
        for (const key of actor.conditions.filter((c) => !updated.conditions.includes(c))) {
          changes.push({ kind: "condition", who: effect.who, key, added: false });
        }
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

      case "grant_inspiration":
        // ADR 0050 : l'etat du tour ne porte pas l'inspiration ; seul un
        // repos l'applique (`applyRestEffects`). Rapporte, jamais perdu.
        changes.push({
          kind: "ignored",
          action: effect.action,
          who: effect.who,
          reason: "Inspiration héroïque non appliquée dans le tour : seul un repos l'accorde aujourd'hui (ADR 0050).",
        });
        break;

      case "apply_effect":
        // V3.1-129 : un effet qui dure se pose par une activation, qui porte
        // sa description (`durable_effects`) ; le tour n'en a pas. Rapporté,
        // jamais perdu, jusqu'au branchement des effets actifs (V3.1-130).
        changes.push({
          kind: "ignored",
          action: effect.action,
          who: effect.who,
          reason: `Effet qui dure « ${effect.effect} » non posé par le tour : seule une activation le pose (ADR 0060).`,
        });
        break;

      case "cast_spell":
        // V3.1-164 (ADR 0076) : lancer un sort se fait par son activation, côté service ; le tour ne le joue pas.
        changes.push({
          kind: "ignored",
          action: effect.action,
          who: effect.who,
          reason: `Sort « ${effect.spell} » non lancé par le tour : seul le service de lancer le joue (ADR 0076).`,
        });
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
