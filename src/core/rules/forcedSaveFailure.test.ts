import { describe, expect, it } from "vitest";
import { conditionsWithSource, saveAutomaticallyFails, saveRuleOutcome, isCharmedBy } from "./forcedSaveFailure";
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

describe("V3.1-191 — une sauvegarde contre vos sorts : désavantage, état de la lanceuse (Embuscade magique)", () => {
  // « Si vous jouissez de l'état Invisible quand vous lancez un sort sur une créature, cette créature est Désavantagée à ses jets de sauvegarde contre ce sort. »
  const EMBUSCADE = zForcedSaveFailuresBlockData.parse({ failures: [{ caster_condition: "invisible", imposed_by_caster: false, outcome: "disadvantage" }] });
  const tout = (sur: Partial<Parameters<typeof saveRuleOutcome>[1]>) => ({ spellKey: "hold-person", casterId: "rufus", targetConditions: [], casterConditions: [], ...sur });

  it("lanceuse invisible : désavantage, contre tous ses sorts (aucun sort nommé)", () => {
    expect(saveRuleOutcome(EMBUSCADE.failures, tout({ casterConditions: ["invisible"] }))).toBe("disadvantage");
    expect(saveRuleOutcome(EMBUSCADE.failures, tout({ spellKey: "fireball", casterConditions: ["invisible"] }))).toBe("disadvantage");
  });

  it("lanceuse visible : rien", () => {
    expect(saveRuleOutcome(EMBUSCADE.failures, tout({}))).toBeNull();
  });

  it("l'échec d'office l'emporte sur le désavantage ; une règle ancienne (sans « outcome ») reste un échec d'office", () => {
    const deux = [...EMBUSCADE.failures, ...MANTE.failures];
    expect(saveRuleOutcome(deux, tout({ spellKey: "command", casterConditions: ["invisible"], targetConditions: [{ key: "charmed", sourceId: "rufus" }] }))).toBe("fail");
    expect(saveRuleOutcome(MANTE.failures, { spellKey: "command", casterId: "lyra", targetConditions: [{ key: "charmed", sourceId: "lyra" }], casterConditions: [] })).toBe("fail");
  });

  it("le schéma exige au moins une condition, sur la cible ou sur la lanceuse", () => {
    expect(zForcedSaveFailuresBlockData.safeParse({ failures: [{ imposed_by_caster: false, outcome: "disadvantage" }] }).success).toBe(false);
  });
});

describe("V3.1-199 — un charmé n'attaque pas celle qui le charme", () => {
  const charme = { payload: { effectId: "e", activationId: "a", source: "lyra", conditions: ["charmed"], endsOn: [], concentration: false, tokenGrants: null, tokenUsesLeft: 0, startedRound: 1 } };

  it("charmé par la cible visée (l'une de ses clés) : vrai", () => {
    expect(isCharmedBy(["charmed"], [charme], ["participant:p1", "lyra"])).toBe(true);
  });

  it("charmé par quelqu'un d'autre, charmé à la main (source inconnue), ou pas charmé : faux", () => {
    expect(isCharmedBy(["charmed"], [charme], ["participant:p2"])).toBe(false);
    expect(isCharmedBy(["charmed"], [], ["lyra"])).toBe(false);
    expect(isCharmedBy([], [charme], ["lyra"])).toBe(false);
  });
});
