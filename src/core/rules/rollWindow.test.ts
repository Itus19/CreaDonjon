import { describe, expect, it } from "vitest";
import type { Rng } from "../dice/rng";
import type { Activation } from "../schemas/rule-blocks/playable";
import { zActivationBlockData } from "../schemas/rule-blocks/playable";
import type { TriggerActorState, TriggerContext } from "./triggers";
import {
  applyRollOperations,
  eligibleReactions,
  outcomeOf,
  recordUse,
  resetReaction,
  turnStamp,
  wouldChangeOutcome,
  EMPTY_TURN_USAGE,
  type PendingRoll,
  type ReactionCandidate,
} from "./rollWindow";

/**
 * V3.1-159 (ADR 0075) — intervenir sur un jet, en fonctions PURES : qui peut
 * réagir, ce que la réaction fait au jet, et le compte de la réaction et du
 * « une fois par tour ». Les dés passent par le `Rng` injecté (règle 8).
 */

/** Un Rng qui rend les valeurs données (0-indexées : 0 = un 1 au dé). */
function des(...valeurs: number[]): Rng {
  let i = 0;
  return { nextInt: () => valeurs[i++] ?? 0 };
}

const n = (value: number) => ({ op: "num" as const, value });
const ref = (name: string) => ({ op: "ref" as const, name });

function acteur(numbers: Record<string, number> = {}): TriggerActorState {
  return { numbers, conditions: [], features: [], hp: 10, hpMax: 10, tempHp: 0 } as unknown as TriggerActorState;
}

function activation(a: Partial<Activation> & Pick<Activation, "id" | "trigger">): Activation {
  return {
    label: { fr: a.id },
    cost: { action: "reaction", resources: [] },
    targets: { kind: "self" },
    effects: [],
    variants: null,
    ...a,
  } as Activation;
}

const ESQUIVE = activation({
  id: "uncanny-dodge",
  trigger: { on: "roll", roll: "damage", subject: "attack_against_self", when: "rolled" },
  roll_operations: [{ op: "damage_multiplier", factor: 0.5 }],
});
const BOUCLIER = activation({
  id: "shield",
  trigger: { on: "roll", roll: "attack", subject: "attack_against_self", when: "hit" },
  roll_operations: [{ op: "ac_bonus", value: n(5) }],
});
const CHANCE = activation({
  id: "luck",
  cost: { action: "none", resources: [] },
  trigger: { on: "roll", roll: "d20", subject: "self", when: "natural", natural: 1, automatic: true },
  roll_operations: [{ op: "reroll" }],
});
const INDOMPTABLE = activation({
  id: "indomitable",
  cost: { action: "none", resources: [{ key: "indomitable", amount: n(1) }] },
  trigger: { on: "roll", roll: "save", subject: "self", when: "failed" },
  roll_operations: [{ op: "reroll", bonus: ref("class.level") }],
});
const COUP_DE_CHANCE = activation({
  id: "stroke-of-luck",
  cost: { action: "none", resources: [{ key: "stroke-of-luck", amount: n(1) }] },
  trigger: { on: "roll", roll: "d20", subject: "self", when: "failed" },
  roll_operations: [{ op: "set_natural", value: 20 }],
});
const MOTS_CINGLANTS = activation({
  id: "cutting-words",
  cost: { action: "reaction", resources: [{ key: "bardic-inspiration", amount: n(1) }] },
  trigger: { on: "roll", roll: "d20", subject: "enemy", when: "rolled", range: { value: 18, unit: "m" } },
  roll_operations: [{ op: "add_die", count: n(1), faces: n(6), sign: -1 }],
});
const SOURNOISE = activation({
  id: "sneak-attack",
  cost: { action: "none", resources: [] },
  trigger: { on: "roll", roll: "damage", subject: "self", when: "rolled" },
  roll_operations: [{ op: "add_damage", formula: { op: "dice", count: n(3), faces: n(6) } }],
  limit: { per: "turn" },
});

const attaque = (p: Partial<PendingRoll> = {}): PendingRoll => ({
  kind: "attack",
  roller: "gobelin",
  target: "lia",
  natural: 12,
  total: 17,
  critRange: 20,
  ac: 15,
  dc: null,
  acBonus: 0,
  damage: null,
  ...p,
});

const ctx: TriggerContext = {
  actors: { gobelin: acteur(), lia: acteur({ "class.level": 5 }), barde: acteur(), guerrier: acteur({ "class.level": 9 }) },
};
const equipes = { gobelin: "monstres", lia: "pj", barde: "pj", guerrier: "pj" };

function candidat(actorId: string, act: Activation, ressources: { key: string; max: number }[] = [], used: Record<string, number> = {}): ReactionCandidate {
  return { actorId, ruleKey: act.id, activation: act, resources: ressources, used, usage: EMPTY_TURN_USAGE };
}

const eligibles = (roll: PendingRoll, candidats: ReactionCandidate[], stamp: string | null = "1:0") =>
  eligibleReactions({ roll, candidates: candidats, ctx, teams: equipes, stamp, rng: des() });

describe("outcomeOf : l'issue d'un jet, refaite par les règles existantes", () => {
  it("attaque : le total contre la CA (plus le bonus de CA contre ce jet) ; 20 naturel touche, 1 rate", () => {
    expect(outcomeOf(attaque())).toBe("hit");
    expect(outcomeOf(attaque({ acBonus: 5 }))).toBe("miss");
    expect(outcomeOf(attaque({ natural: 20, total: 3 }))).toBe("hit");
    expect(outcomeOf(attaque({ natural: 19, total: 3, critRange: 19 }))).toBe("hit");
    expect(outcomeOf(attaque({ natural: 1, total: 30 }))).toBe("miss");
    expect(outcomeOf(attaque({ ac: null }))).toBeNull();
  });

  it("sauvegarde et test : le total contre le DD ; sans DD, aucune issue inventée", () => {
    const sauv: PendingRoll = { ...attaque(), kind: "save", target: null, ac: null, dc: 15, total: 14 };
    expect(outcomeOf(sauv)).toBe("failure");
    expect(outcomeOf({ ...sauv, total: 15 })).toBe("success");
    expect(outcomeOf({ ...sauv, dc: null })).toBeNull();
  });
});

describe("eligibleReactions : qui peut réagir", () => {
  it("Bouclier : la cible touchée, pas l'attaquant ni un allié ; pas sur un échec", () => {
    const r = eligibles(attaque(), [candidat("lia", BOUCLIER), candidat("barde", BOUCLIER), candidat("gobelin", BOUCLIER)]);
    expect(r.choices.map((c) => c.actorId)).toEqual(["lia"]);
    expect(eligibles(attaque({ total: 10 }), [candidat("lia", BOUCLIER)]).choices).toEqual([]);
  });

  it("Bouclier change une touche à 17 contre CA 15 en échec, et le dit ; pas une touche à 25", () => {
    expect(eligibles(attaque(), [candidat("lia", BOUCLIER)]).choices[0].changesOutcome).toBe(true);
    expect(eligibles(attaque({ total: 25 }), [candidat("lia", BOUCLIER)]).choices[0].changesOutcome).toBe(false);
  });

  it("Chance : un 1 naturel sur son propre d20, sans fenêtre (automatique)", () => {
    const sauv: PendingRoll = { ...attaque(), roller: "lia", kind: "save", target: null, ac: null, dc: 12, natural: 1, total: 3 };
    const r = eligibles(sauv, [candidat("lia", CHANCE)]);
    expect(r.automatic.map((c) => c.ruleKey)).toEqual(["luck"]);
    expect(r.choices).toEqual([]);
    expect(eligibles({ ...sauv, natural: 2 }, [candidat("lia", CHANCE)]).automatic).toEqual([]);
  });

  it("Mots cinglants : un jet ENNEMI, jamais celui d'un allié ; il faut une Inspiration bardique", () => {
    const res = [{ key: "bardic-inspiration", max: 3 }];
    expect(eligibles(attaque(), [candidat("barde", MOTS_CINGLANTS, res)]).choices.map((c) => c.actorId)).toEqual(["barde"]);
    const jetAllie = attaque({ roller: "lia", target: "gobelin" });
    expect(eligibles(jetAllie, [candidat("barde", MOTS_CINGLANTS, res)]).choices).toEqual([]);
    expect(eligibles(attaque(), [candidat("barde", MOTS_CINGLANTS, res, { "bardic-inspiration": 3 })]).choices).toEqual([]);
  });

  it("une réaction déjà dépensée dans le round : plus éligible ; une activation sans coût de réaction l'est encore", () => {
    const depensee = { ...EMPTY_TURN_USAGE, reaction_spent: true };
    expect(eligibles(attaque(), [{ ...candidat("lia", BOUCLIER), usage: depensee }]).choices).toEqual([]);
    const sauv: PendingRoll = { ...attaque(), roller: "guerrier", kind: "save", target: null, ac: null, dc: 15, total: 10 };
    const res = [{ key: "indomitable", max: 1 }];
    expect(eligibles(sauv, [{ ...candidat("guerrier", INDOMPTABLE, res), usage: depensee }]).choices).toHaveLength(1);
  });

  it("Attaque sournoise : une fois par tour ; le tour suivant, de nouveau ; hors combat, sans compte", () => {
    const degats: PendingRoll = { ...attaque(), kind: "damage", roller: "lia", target: "gobelin", damage: { base: 6, multiplier: 1 } };
    const usage = recordUse(EMPTY_TURN_USAGE, { key: "sneak-attack:sneak-attack", reaction: false, stamp: "1:0" });
    expect(eligibles(degats, [{ ...candidat("lia", SOURNOISE), usage }], "1:0").choices).toEqual([]);
    expect(eligibles(degats, [{ ...candidat("lia", SOURNOISE), usage }], "1:1").choices).toHaveLength(1);
    expect(eligibles(degats, [{ ...candidat("lia", SOURNOISE), usage }], null).choices).toHaveLength(1);
  });

  it("chacun au plus une fois par fenêtre", () => {
    const r = eligibles(attaque(), [candidat("lia", BOUCLIER), candidat("lia", BOUCLIER)]);
    expect(r.choices).toHaveLength(1);
  });
});

describe("applyRollOperations : ce que la réaction fait au jet", () => {
  it("Chance relance le 1 ; le nouveau dé s'impose", () => {
    const sauv: PendingRoll = { ...attaque(), roller: "lia", kind: "save", target: null, ac: null, dc: 12, natural: 1, total: 3 };
    const r = applyRollOperations(sauv, [{ actorId: "lia", operations: CHANCE.roll_operations!, numbers: {} }], des(13));
    expect(r.roll.natural).toBe(14);
    expect(r.roll.total).toBe(16);
    expect(outcomeOf(r.roll)).toBe("success");
  });

  it("Indomptable relance une sauvegarde ratée avec + niveau de guerrier", () => {
    const sauv: PendingRoll = { ...attaque(), roller: "guerrier", kind: "save", target: null, ac: null, dc: 18, natural: 5, total: 7 };
    const r = applyRollOperations(sauv, [{ actorId: "guerrier", operations: INDOMPTABLE.roll_operations!, numbers: { "class.level": 9 } }], des(7));
    expect(r.roll.natural).toBe(8);
    expect(r.roll.total).toBe(7 - 5 + 8 + 9);
    expect(outcomeOf(r.roll)).toBe("success");
  });

  it("Coup de chance : le test raté devient un 20", () => {
    const test: PendingRoll = { ...attaque(), roller: "lia", kind: "check", target: null, ac: null, dc: 20, natural: 4, total: 9 };
    const r = applyRollOperations(test, [{ actorId: "lia", operations: COUP_DE_CHANCE.roll_operations!, numbers: {} }], des());
    expect(r.roll.natural).toBe(20);
    expect(r.roll.total).toBe(25);
  });

  it("Mots cinglants retire le dé ; Bouclier ajoute à la CA contre ce jet", () => {
    const r = applyRollOperations(
      attaque(),
      [
        { actorId: "barde", operations: MOTS_CINGLANTS.roll_operations!, numbers: {} },
        { actorId: "lia", operations: BOUCLIER.roll_operations!, numbers: {} },
      ],
      des(2),
    );
    expect(r.roll.total).toBe(14);
    expect(r.roll.acBonus).toBe(5);
    expect(outcomeOf(r.roll)).toBe("miss");
    expect(r.steps.map((s) => s.op)).toEqual(["add_die", "ac_bonus"]);
  });

  it("Esquive instinctive divise les dégâts (arrondi à l'inférieur) ; Attaque sournoise les augmente avant", () => {
    const degats: PendingRoll = { ...attaque(), kind: "damage", damage: { base: 11, multiplier: 1 } };
    const r = applyRollOperations(degats, [{ actorId: "lia", operations: ESQUIVE.roll_operations!, numbers: {} }], des());
    expect(r.roll.total).toBe(5);
    const s = applyRollOperations(
      { ...degats, roller: "lia" },
      [
        { actorId: "lia", operations: SOURNOISE.roll_operations!, numbers: {} },
        { actorId: "gobelin", operations: ESQUIVE.roll_operations!, numbers: {} },
      ],
      des(0, 1, 2),
    );
    expect(s.roll.total).toBe(Math.floor((11 + 1 + 2 + 3) / 2));
  });
});

describe("wouldChangeOutcome", () => {
  it("vrai, faux, ou inconnu (null) quand un dé décide", () => {
    expect(wouldChangeOutcome(attaque(), BOUCLIER.roll_operations!, {})).toBe(true);
    expect(wouldChangeOutcome(attaque({ total: 30 }), BOUCLIER.roll_operations!, {})).toBe(false);
    expect(wouldChangeOutcome(attaque(), MOTS_CINGLANTS.roll_operations!, {})).toBeNull();
  });
});

describe("le compte de la réaction et du « une fois par tour »", () => {
  it("dépenser la réaction, puis la retrouver au début de son tour ; les usages par tour restent datés", () => {
    const u = recordUse(EMPTY_TURN_USAGE, { key: "shield:shield", reaction: true, stamp: turnStamp(2, 1) });
    expect(u).toEqual({ reaction_spent: true, once: { "shield:shield": "2:1" } });
    expect(resetReaction(u)).toEqual({ reaction_spent: false, once: { "shield:shield": "2:1" } });
  });
});

describe("le schéma refuse une opération hors de propos", () => {
  it("ac_bonus sur une sauvegarde, une opération sans déclencheur", () => {
    const bloc = (a: object) => zActivationBlockData.safeParse({ activations: [{ ...ESQUIVE, ...a }], durable_effects: [] });
    expect(bloc({}).success).toBe(true);
    expect(bloc({ trigger: { on: "roll", roll: "save", subject: "self", when: "failed" }, roll_operations: [{ op: "ac_bonus", value: n(5) }] }).success).toBe(false);
    expect(bloc({ trigger: undefined }).success).toBe(false);
    expect(bloc({ trigger: { on: "roll", roll: "save", subject: "self", when: "hit" }, roll_operations: [] }).success).toBe(false);
  });
});
