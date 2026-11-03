import { describe, expect, it } from "vitest";
import { parseBlockData } from "./blocks";
import { zActivationBlockData, zCoverageBlockData, zRuleResourcesBlockData } from "./playable";

/** V3.1-129 (ADR 0060) — les trois blocs de règle de la fondation, tels que l'ADR les écrit. */

const ABJURATION = {
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
};

describe("zRuleResourcesBlockData", () => {
  it("accepte la ressource de l'ADR (Conduit divin, colonne de progression)", () => {
    const data = {
      resources: [{ key: "channel-divinity", label: { fr: "Conduit divin" }, max: { op: "ref", name: "column.channel_divinity" }, recharge: "short_rest_one" }],
    };
    expect(zRuleResourcesBlockData.parse(data)).toEqual(data);
  });

  it("refuse une recharge inconnue et deux ressources de même clé", () => {
    const base = { key: "rage", label: { fr: "Rage" }, max: { op: "num", value: 2 } };
    expect(zRuleResourcesBlockData.safeParse({ resources: [{ ...base, recharge: "hourly" }] }).success).toBe(false);
    expect(zRuleResourcesBlockData.safeParse({ resources: [{ ...base, recharge: "long_rest" }, { ...base, recharge: "long_rest" }] }).success).toBe(false);
  });
});

describe("zActivationBlockData", () => {
  it("accepte Abjuration d'ennemis telle que l'ADR 0060 l'écrit", () => {
    expect(zActivationBlockData.parse(ABJURATION)).toEqual(ABJURATION);
  });

  it("`durable_effects` absent vaut une liste vide", () => {
    expect(zActivationBlockData.parse({ activations: [{ ...ABJURATION.activations[0], effects: [] }] }).durable_effects).toEqual([]);
  });

  it("refuse un `apply_effect` qui vise un effet que le bloc ne décrit pas", () => {
    expect(zActivationBlockData.safeParse({ ...ABJURATION, durable_effects: [] }).success).toBe(false);
  });

  it("refuse un coût d'action hors vocabulaire et une unité de portée autre que le mètre", () => {
    const a = ABJURATION.activations[0];
    expect(zActivationBlockData.safeParse({ ...ABJURATION, activations: [{ ...a, cost: { ...a.cost, action: "ritual" } }] }).success).toBe(false);
    expect(
      zActivationBlockData.safeParse({ ...ABJURATION, activations: [{ ...a, targets: { ...a.targets, range: { value: 60, unit: "ft" } } }] }).success,
    ).toBe(false);
  });

  it("accepte des variantes avec leur propre coût, et un jeton sur un effet qui dure", () => {
    const data = {
      activations: [
        {
          id: "inspiration",
          label: { fr: "Inspiration bardique" },
          cost: { action: "bonus", resources: [{ key: "bardic-inspiration", amount: { op: "num", value: 1 } }] },
          targets: { kind: "ally", count: { op: "num", value: 1 } },
          effects: [{ action: "apply_effect", who: "target", effect: "bardic-die" }],
          variants: [{ id: "longue", label: { fr: "Longue" }, effects: [], cost: { action: "action", resources: [] } }],
        },
        { id: "use-die", label: { fr: "Dé d'inspiration" }, cost: { action: "none", resources: [] }, targets: { kind: "self" }, effects: [{ action: "roll", label: "Dé", formula: { op: "dice", count: 1, faces: 6 } }], variants: null },
      ],
      durable_effects: [
        {
          id: "bardic-die",
          label: { fr: "Dé d'inspiration" },
          conditions: [],
          modifiers: [],
          duration: { unit: "hour", amount: 1 },
          concentration: false,
          ends_on: [{ event: "dismissed" }],
          token: { uses: 1, grants: "use-die" },
        },
      ],
    };
    expect(zActivationBlockData.parse(data)).toEqual(data);
  });

  it("refuse un jeton qui accorde une activation absente du bloc", () => {
    const fx = { ...ABJURATION.durable_effects[0], token: { uses: 1, grants: "inconnue" } };
    expect(zActivationBlockData.safeParse({ ...ABJURATION, durable_effects: [fx] }).success).toBe(false);
  });

  it("accepte les durées « jusqu'à la fin du tour », « jusqu'au repos » et « permanent »", () => {
    for (const duration of [
      { unit: "until_turn_end", whose: "source", which: "next" },
      { unit: "until_rest" },
      { unit: "permanent" },
    ]) {
      const fx = { ...ABJURATION.durable_effects[0], duration };
      expect(zActivationBlockData.safeParse({ ...ABJURATION, durable_effects: [fx] }).success).toBe(true);
    }
  });
});

describe("zCoverageBlockData", () => {
  it("accepte les lacunes déclarées", () => {
    const data = { gaps: [{ text: "ne peut faire qu'une seule chose à son tour", missing: "restriction de tour" }] };
    expect(zCoverageBlockData.parse(data)).toEqual(data);
  });
});

describe("registre des blocs de règle", () => {
  it("valide les trois nouveaux blocs par leur type", () => {
    expect(parseBlockData("activation", ABJURATION).ok).toBe(true);
    expect(parseBlockData("resources", { resources: [] }).ok).toBe(true);
    expect(parseBlockData("coverage", { gaps: [] }).ok).toBe(true);
  });
});
