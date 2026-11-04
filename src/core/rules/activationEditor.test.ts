import { describe, expect, it } from "vitest";
import { zActivationBlockData, zRuleResourcesBlockData, type ActivationBlockData } from "../schemas/rule-blocks/playable";
import { coverageState } from "./activation";
import { applyOverrideFacts, brickPaths, coverageSummary, pruneOrphanDurableEffects } from "./activationEditor";

/**
 * V3.1-132 — le noyau de l'éditeur de briques : chaque brique a un chemin
 * stable (pour y attacher le passage du texte dont elle vient), la couverture
 * se résume (« N briques sur M citées »), et un effet qui dure que plus rien
 * ne pose disparaît (à l'écran, « Appliquer un état » est UNE brique).
 */

const num = (value: number) => ({ op: "num" as const, value });

const BLOC: ActivationBlockData = zActivationBlockData.parse({
  activations: [
    {
      id: "abjure",
      label: { fr: "Abjuration d'ennemis" },
      cost: { action: "magic", resources: [{ key: "channel-divinity", amount: num(1) }] },
      targets: { kind: "creature", range: { value: 18, unit: "m" } },
      effects: [
        {
          action: "saving_throw",
          who: "target",
          ability: "wis",
          dc: num(13),
          on_fail: [{ action: "apply_effect", who: "target", effect: "effraye" }],
          on_pass: [{ action: "deal_damage", who: "target", amount: num(2) }],
        },
      ],
      variants: [{ id: "v", label: { fr: "Variante" }, effects: [{ action: "heal", who: "self", amount: num(1) }] }],
      passages: { cost: "dépensez une utilisation de Conduit divin", "effects.0.on_fail.0": "elle a l'état Effrayé" },
    },
  ],
  durable_effects: [
    {
      id: "effraye",
      label: { fr: "Effrayé" },
      conditions: ["frightened"],
      modifiers: [],
      duration: { unit: "minute", amount: 1 },
      concentration: false,
      ends_on: [],
      token: null,
      passage: "pendant 1 minute",
    },
  ],
});

describe("schémas — passages facultatifs", () => {
  it("une ressource et une activation sans passage restent valides", () => {
    expect(zRuleResourcesBlockData.safeParse({ resources: [{ key: "k", label: { fr: "K" }, max: num(1), recharge: "long_rest" }] }).success).toBe(true);
    const sans = { ...BLOC.activations[0], passages: undefined };
    expect(zActivationBlockData.safeParse({ activations: [sans], durable_effects: BLOC.durable_effects }).success).toBe(true);
  });

  it("un passage vide est refusé", () => {
    const r = zRuleResourcesBlockData.safeParse({ resources: [{ key: "k", label: { fr: "K" }, max: num(1), recharge: "long_rest", passage: "" }] });
    expect(r.success).toBe(false);
  });

  it("un passage attaché à une brique qui n'existe pas est refusé", () => {
    const a = { ...BLOC.activations[0], passages: { "effects.4": "rien" } };
    expect(zActivationBlockData.safeParse({ activations: [a], durable_effects: BLOC.durable_effects }).success).toBe(false);
  });
});

describe("brickPaths", () => {
  it("liste coût, cibles, effets imbriqués et effets des variantes", () => {
    expect(brickPaths(BLOC.activations[0])).toEqual([
      "cost",
      "targets",
      "effects.0",
      "effects.0.on_fail.0",
      "effects.0.on_pass.0",
      "variants.0.effects.0",
    ]);
  });
});

describe("coverageSummary", () => {
  it("compte les briques et celles qui citent le texte, ressources et effets qui durent compris", () => {
    const res = zRuleResourcesBlockData.parse({
      resources: [{ key: "channel-divinity", label: { fr: "Conduit divin" }, max: num(2), recharge: "short_rest_one", passage: "deux fois" }],
    });
    const s = coverageSummary([
      { blockType: "resources", data: res },
      { blockType: "activation", data: BLOC },
    ]);
    // 1 ressource + 6 briques d'activation + 1 effet qui dure = 8 ; citées : 1 + 2 + 1 = 4.
    expect(s).toEqual({ state: "playable", bricks: 8, cited: 4, gaps: 0 });
  });

  it("une lacune rend la règle partielle ; sans bloc mécanique, non évaluée", () => {
    expect(coverageSummary([{ blockType: "coverage", data: { gaps: [{ text: "t", missing: "m" }] } }]).state).toBe("partial");
    expect(coverageSummary([{ blockType: "description", data: {} }])).toEqual({ state: "unevaluated", bricks: 0, cited: 0, gaps: 0 });
  });
});

describe("pruneOrphanDurableEffects", () => {
  it("retire un effet qui dure que plus aucune brique ne pose", () => {
    const sansEtat = {
      ...BLOC,
      activations: [{ ...BLOC.activations[0], effects: [{ action: "heal" as const, who: "self", amount: num(1) }], passages: undefined }],
    };
    expect(pruneOrphanDurableEffects(sansEtat).durable_effects).toEqual([]);
  });

  it("garde un effet posé, même dans une branche de sauvegarde", () => {
    expect(pruneOrphanDurableEffects(BLOC).durable_effects.map((e) => e.id)).toEqual(["effraye"]);
  });
});

describe("applyOverrideFacts — la couverture de toute une variante", () => {
  const base = () =>
    new Map([
      ["a", { types: new Set(["description"]), gaps: 0 }],
      ["b", { types: new Set(["description", "modifiers"]), gaps: 0 }],
    ]);

  it("un add_block d'activation rend la règle jouable ; un remove_block la rend non évaluée", () => {
    const r = applyOverrideFacts(base(), [
      { entryKey: "a", action: "add_block", blockType: "activation", payload: {} },
      { entryKey: "b", action: "remove_block", blockType: "modifiers", payload: {} },
    ]);
    expect(coverageState({ blockTypes: [...r.get("a")!.types], gaps: [] })).toBe("playable");
    expect(coverageState({ blockTypes: [...r.get("b")!.types], gaps: [] })).toBe("unevaluated");
  });

  it("un bloc coverage compte ses lacunes ; une fiche maison et une version maison se lisent ; une fiche retirée disparaît", () => {
    const r = applyOverrideFacts(base(), [
      { entryKey: "a", action: "add_block", blockType: "coverage", payload: { data: { gaps: [{ text: "t", missing: "m" }, { text: "u", missing: "n" }] } } },
      { entryKey: "c", action: "add_entry", blockType: null, payload: {} },
      { entryKey: "c", action: "add_block", blockType: "triggers", payload: {} },
      { entryKey: "b", action: "replace_entry", blockType: null, payload: { blocks: [{ block_type: "description" }] } },
      { entryKey: "a", action: "disable_entry", blockType: null, payload: {} },
    ]);
    expect(r.has("a")).toBe(false);
    expect([...r.get("c")!.types]).toEqual(["triggers"]);
    expect([...r.get("b")!.types]).toEqual(["description"]);
    const g = applyOverrideFacts(base(), [{ entryKey: "a", action: "add_block", blockType: "coverage", payload: { data: { gaps: [{ text: "t", missing: "m" }] } } }]);
    expect(g.get("a")!.gaps).toBe(1);
  });
});
