import { describe, expect, it } from "vitest";
import type { Rng } from "../dice/rng";
import { zActivationBlockData, type ActivationBlockData } from "../schemas/rule-blocks/playable";
import { budgetForTurn } from "./actionBudget";
import { coverageState, planActivation } from "./activation";
import type { TriggerContext } from "./triggers";

/**
 * V3.1-129 (ADR 0060) — l'activation d'une règle, en fonction pure : elle
 * vérifie, lance les dés par le `Rng` injecté et rend un PLAN d'écritures.
 * Rien n'est écrit ici ; le service l'appliquera en une fois (V3.1-130).
 */

/** Rend les d20 dans l'ordre donné (valeur de face, 1 à 20). */
function d20s(...faces: number[]): Rng {
  let i = 0;
  return {
    nextInt(max: number) {
      if (i >= faces.length) throw new Error("plus de dé prévu dans le test");
      const face = faces[i++];
      if (face < 1 || face > max) throw new Error(`face ${face} hors du dé ${max}`);
      return face - 1;
    },
  };
}

const BLOC: ActivationBlockData = zActivationBlockData.parse({
  activations: [
    {
      id: "abjure",
      label: { fr: "Abjuration d'ennemis" },
      requires: { op: "gte", args: [{ op: "ref", name: "level" }, { op: "num", value: 3 }] },
      cost: { action: "magic", resources: [{ key: "channel-divinity", amount: { op: "num", value: 1 } }] },
      targets: {
        kind: "creature",
        count: { op: "max", args: [{ op: "num", value: 1 }, { op: "ref", name: "ability.cha" }] },
        range: { value: 18, unit: "m" },
        must_see: true,
      },
      effects: [
        {
          action: "saving_throw",
          who: "target",
          ability: "wis",
          dc: { op: "ref", name: "spell_save_dc" },
          on_fail: [{ action: "apply_effect", who: "target", effect: "frightened-abjure" }],
        },
      ],
      variants: null,
    },
  ],
  durable_effects: [
    {
      id: "frightened-abjure",
      label: { fr: "Effrayé (Abjuration)" },
      conditions: ["frightened"],
      modifiers: [],
      duration: { unit: "minute", amount: 1 },
      concentration: false,
      ends_on: [{ event: "damage_taken", subject: "bearer" }],
      token: null,
    },
  ],
});

/** Paladin 9, CHA +3, DD 15 ; trois gobelins à Sagesse -1. */
function scene(extra: Partial<Record<string, number>> = {}): TriggerContext {
  const gobelin = { conditions: [], features: [], numbers: { "save.wis": -1 } };
  return {
    actors: {
      paladin: { conditions: [], features: [], numbers: { level: 9, "ability.cha": 3, spell_save_dc: 15, proficiency: 4, ...extra } as Record<string, number> },
      g1: gobelin,
      g2: gobelin,
      g3: gobelin,
      g4: gobelin,
    },
  };
}

const base = {
  block: BLOC,
  activationId: "abjure",
  actorId: "paladin",
  resources: [{ key: "channel-divinity", max: 2 }],
  used: {},
  budget: budgetForTurn(9),
  currentTurn: "paladin",
  round: 1,
};

describe("planActivation — Abjuration d'ennemis", () => {
  it("trois cibles au plus avec CHA +3 : une sauvegarde chacune, Effrayé sur les échecs, 1 Conduit divin et l'action consommés", () => {
    // g1 : 4 - 1 = 3 (échec) ; g2 : 20 - 1 = 19 (réussite) ; g3 : 10 - 1 = 9 (échec).
    const r = planActivation({ ...base, targetIds: ["g1", "g2", "g3"], ctx: scene(), rng: d20s(4, 20, 10) });
    if (!r.ok) throw new Error(r.reason);
    const saves = r.plan.effects.filter((e) => e.action === "saving_throw");
    expect(saves.map((s) => [s.who, s.dc, s.roll, s.total, s.passed])).toEqual([
      ["g1", 15, 4, 3, false],
      ["g2", 15, 20, 19, true],
      ["g3", 15, 10, 9, false],
    ]);
    expect(r.plan.applied.map((a) => a.bearer)).toEqual(["g1", "g3"]);
    expect(r.plan.applied[0]).toMatchObject({ effectId: "frightened-abjure", source: "paladin", conditions: ["frightened"], concentration: false });
    expect(r.plan.used).toEqual({ "channel-divinity": 1 });
    expect(r.plan.spend).toEqual([{ key: "channel-divinity", amount: 1 }]);
    // L'action « Magie » se paie sur l'action du tour.
    expect(r.plan.budget?.action).toBe(0);
    expect(r.plan.overBudget).toBe(false);
  });

  it("une quatrième cible est refusée, sans rien écrire", () => {
    const r = planActivation({ ...base, targetIds: ["g1", "g2", "g3", "g4"], ctx: scene(), rng: d20s() });
    expect(r).toEqual({ ok: false, reason: "too_many_targets" });
  });

  it("sans ressource suffisante, refusée avec sa raison, sans lancer un dé", () => {
    const r = planActivation({ ...base, used: { "channel-divinity": 2 }, targetIds: ["g1"], ctx: scene(), rng: d20s() });
    expect(r).toEqual({ ok: false, reason: "not_enough_resource", detail: "channel-divinity" });
  });

  it("une ressource que le personnage n'a pas compte pour zéro", () => {
    const r = planActivation({ ...base, resources: [], targetIds: ["g1"], ctx: scene(), rng: d20s() });
    expect(r).toEqual({ ok: false, reason: "not_enough_resource", detail: "channel-divinity" });
  });

  it("`requires` non rempli (niveau 2) : refusée", () => {
    const r = planActivation({ ...base, targetIds: ["g1"], ctx: scene({ level: 2 }), rng: d20s() });
    expect(r).toEqual({ ok: false, reason: "requires_not_met" });
  });

  it("aucune cible pour une activation qui en demande : refusée ; une cible absente de la scène aussi", () => {
    expect(planActivation({ ...base, targetIds: [], ctx: scene(), rng: d20s() })).toEqual({ ok: false, reason: "no_target" });
    expect(planActivation({ ...base, targetIds: ["fantome"], ctx: scene(), rng: d20s() })).toEqual({ ok: false, reason: "unknown_target", detail: "fantome" });
  });

  it("une activation inconnue du bloc : refusée", () => {
    expect(planActivation({ ...base, activationId: "rien", targetIds: ["g1"], ctx: scene(), rng: d20s() })).toEqual({ ok: false, reason: "unknown_activation" });
  });

  it("un budget déjà vide ne bloque pas (le moteur l'affiche, ADR 0029) : le plan le signale", () => {
    const r = planActivation({ ...base, budget: { ...budgetForTurn(9), action: 0 }, targetIds: ["g1"], ctx: scene(), rng: d20s(20) });
    if (!r.ok) throw new Error(r.reason);
    expect(r.plan.overBudget).toBe(true);
  });
});

describe("planActivation — soi, variantes et coût « none »", () => {
  const bloc = zActivationBlockData.parse({
    activations: [
      {
        id: "second-wind",
        label: { fr: "Second souffle" },
        cost: { action: "bonus", resources: [{ key: "second-wind", amount: { op: "num", value: 1 } }] },
        targets: { kind: "self" },
        effects: [{ action: "heal", who: "self", amount: { op: "add", args: [{ op: "dice", count: 1, faces: 10 }, { op: "ref", name: "level" }] } }],
        variants: [
          { id: "fort", label: { fr: "Fort" }, effects: [{ action: "heal", who: "self", amount: { op: "num", value: 20 } }], cost: { action: "action", resources: [{ key: "second-wind", amount: { op: "num", value: 2 } }] } },
        ],
      },
    ],
  });
  const ctx: TriggerContext = { actors: { guerrier: { conditions: [], features: [], numbers: { level: 5 } } } };
  const p = { block: bloc, activationId: "second-wind", actorId: "guerrier", targetIds: [], ctx, resources: [{ key: "second-wind", max: 2 }], used: {}, budget: budgetForTurn(9), currentTurn: "guerrier", round: 1 };

  it("vise le personnage lui-même, lance 1d10 + niveau, paie l'action bonus", () => {
    const r = planActivation({ ...p, rng: d20s(7) });
    if (!r.ok) throw new Error(r.reason);
    expect(r.plan.effects).toEqual([{ action: "heal", who: "guerrier", amount: 12 }]);
    expect(r.plan.budget?.bonus).toBe(0);
    expect(r.plan.budget?.action).toBe(1);
  });

  it("une variante remplace les effets ET le coût quand elle en a un", () => {
    const r = planActivation({ ...p, variantId: "fort", rng: d20s() });
    if (!r.ok) throw new Error(r.reason);
    expect(r.plan.effects).toEqual([{ action: "heal", who: "guerrier", amount: 20 }]);
    expect(r.plan.used).toEqual({ "second-wind": 2 });
    expect(r.plan.budget?.action).toBe(0);
    expect(r.plan.variantId).toBe("fort");
  });

  it("une variante inconnue : refusée", () => {
    expect(planActivation({ ...p, variantId: "inconnue", rng: d20s() })).toEqual({ ok: false, reason: "unknown_variant" });
  });
});

describe("coverageState — l'état de couverture d'une fiche (ADR 0060 §4)", () => {
  it("jouable : au moins un bloc mécanique et aucune lacune", () => {
    expect(coverageState({ blockTypes: ["description", "activation"], gaps: [] })).toBe("playable");
  });
  it("partielle : des lacunes déclarées, même avec des blocs mécaniques", () => {
    expect(coverageState({ blockTypes: ["activation"], gaps: [{ text: "x", missing: "y" }] })).toBe("partial");
  });
  it("non évaluée : ni bloc mécanique ni lacune", () => {
    expect(coverageState({ blockTypes: ["description"], gaps: [] })).toBe("unevaluated");
  });
});
