import { describe, expect, it } from "vitest";
import { conditionsWithSource, saveAutomaticallyFails } from "./forcedSaveFailure";
import { zForcedSaveFailuresBlockData } from "../schemas/rule-blocks/blocks";

/**
 * V3.1-186 — « une créature Charmée par vous rate automatiquement son jet de
 * sauvegarde contre toute injonction que vous lancez » (Mante de majesté).
 */
const MANTE = zForcedSaveFailuresBlockData.parse({ failures: [{ spells: ["command"], target_condition: "charmed", imposed_by_caster: true }] });

describe("l'échec automatique d'une sauvegarde", () => {
  it("une injonction contre une créature charmée par la lanceuse échoue d'office", () => {
    expect(
      saveAutomaticallyFails(MANTE.failures, { spellKey: "command", casterId: "lyra", targetConditions: [{ key: "charmed", sourceId: "lyra" }] })
    ).toBe(true);
  });

  it("charmée par quelqu'un d'autre : la sauvegarde se lance", () => {
    expect(saveAutomaticallyFails(MANTE.failures, { spellKey: "command", casterId: "lyra", targetConditions: [{ key: "charmed", sourceId: "autre" }] })).toBe(false);
  });

  it("un autre sort, ou une cible non charmée : la sauvegarde se lance", () => {
    expect(saveAutomaticallyFails(MANTE.failures, { spellKey: "hold-person", casterId: "lyra", targetConditions: [{ key: "charmed", sourceId: "lyra" }] })).toBe(false);
    expect(saveAutomaticallyFails(MANTE.failures, { spellKey: "command", casterId: "lyra", targetConditions: [] })).toBe(false);
  });

  it("sans « imposé par la lanceuse », l'état suffit, d'où qu'il vienne ; sans source connue, il ne suffit pas quand elle est exigée", () => {
    const libre = [{ spells: ["command"], target_condition: "charmed", imposed_by_caster: false }];
    expect(saveAutomaticallyFails(libre, { spellKey: "command", casterId: "lyra", targetConditions: [{ key: "charmed", sourceId: null }] })).toBe(true);
    expect(saveAutomaticallyFails(MANTE.failures, { spellKey: "command", casterId: "lyra", targetConditions: [{ key: "charmed", sourceId: null }] })).toBe(false);
  });

  it("le schéma refuse une règle sans sort", () => {
    expect(zForcedSaveFailuresBlockData.safeParse({ failures: [{ spells: [], target_condition: "charmed", imposed_by_caster: true }] }).success).toBe(false);
  });
});

describe("les états de la cible, avec leur source", () => {
  const payload = (source: string, conditions: string[]) => ({
    effectId: "e",
    activationId: "envouter",
    source,
    conditions,
    endsOn: [],
    concentration: false,
    tokenGrants: null,
    tokenUsesLeft: 0,
    startedRound: null,
  });

  it("un état posé par un effet de règle porte sa source ; un état posé à la main n'en a pas", () => {
    expect(conditionsWithSource(["charmed", "prone"], [{ payload: payload("lyra", ["charmed"]) }])).toEqual([
      { key: "charmed", sourceId: "lyra" },
      { key: "prone", sourceId: null },
    ]);
  });

  it("un effet mal formé est ignoré, sans faire tomber la lecture", () => {
    expect(conditionsWithSource(["charmed"], [{ payload: { n_importe: "quoi" } }])).toEqual([{ key: "charmed", sourceId: null }]);
  });
});
