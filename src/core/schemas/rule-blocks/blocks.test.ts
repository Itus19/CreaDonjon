import { describe, expect, it } from "vitest";
import {
  validateBlockData,
  zClassProgressionBlockData,
  zCustomTableBlockData,
  zDescriptionBlockData,
  zEffectsBlockData,
  zScalingBlockData,
  zSpellCastingBlockData,
} from "./blocks";

describe("zDescriptionBlockData", () => {
  it("accepte une liste de segments", () => {
    expect(zDescriptionBlockData.parse({ segments: [{ text: "Un texte." }] })).toEqual({
      segments: [{ text: "Un texte." }],
    });
  });
});

describe("zSpellCastingBlockData", () => {
  it("accepte une fiche d'incantation complete", () => {
    const data = {
      level: 3,
      school: "Evocation",
      casting_time: "1 action",
      range: "150 feet",
      components: ["V", "S", "M"],
      material: "Un peu de guano de chauve-souris et de soufre.",
      duration: "Instantaneous",
      concentration: false,
      ritual: false,
    };
    expect(zSpellCastingBlockData.parse(data)).toEqual(data);
  });

  it("refuse un composant inconnu", () => {
    expect(() =>
      zSpellCastingBlockData.parse({
        level: 1,
        school: "Evocation",
        casting_time: "1 action",
        range: "self",
        components: ["X"],
        duration: "Instantaneous",
        concentration: false,
        ritual: false,
      })
    ).toThrow();
  });
});

describe("zEffectsBlockData", () => {
  it("accepte une liste d'effets avec formule", () => {
    const data = {
      effects: [
        {
          id: "e1",
          damage_type: "fire",
          formula: { op: "dice", count: 8, faces: 6 },
          save: { ability: "dex", effect_on_success: "half" },
        },
      ],
    };
    expect(zEffectsBlockData.parse(data)).toEqual(data);
  });
});

describe("zScalingBlockData", () => {
  it("accepte une table de paliers (cas de l'import SRD)", () => {
    const data = {
      axis: "slot_level",
      base: 2,
      rule: null,
      table: { "3": "5d4", "4": "6d4" },
    };
    expect(zScalingBlockData.parse(data)).toEqual(data);
  });

  it("accepte une regle reguliere plutot qu'une table", () => {
    const data = {
      axis: "slot_level",
      base: 3,
      rule: {
        kind: "delta_per_step",
        target: "effects.e1.damage.formula",
        per_step: { op: "dice", count: 1, faces: 6 },
      },
      table: null,
    };
    expect(zScalingBlockData.parse(data)).toEqual(data);
  });
});

describe("zClassProgressionBlockData", () => {
  it("accepte des colonnes declarees et des lignes en donnees", () => {
    const data = {
      max_level: 20,
      columns: [
        { key: "level", label: { fr: "Niveau" }, kind: "level" },
        { key: "features", label: { fr: "Aptitudes" }, kind: "grants" },
      ],
      rows: [{ level: 1, features: [{ feature: "rage" }] }],
    };
    expect(zClassProgressionBlockData.parse(data)).toEqual(data);
  });
});

describe("zCustomTableBlockData (l'echappatoire)", () => {
  it("accepte des colonnes et lignes libres", () => {
    const data = { columns: ["field", "value"], rows: [{ field: "weight", value: "2" }] };
    expect(zCustomTableBlockData.parse(data)).toEqual(data);
  });
});

describe("validateBlockData", () => {
  it("route vers le bon schema selon block_type", () => {
    expect(() => validateBlockData("description", { segments: [] })).not.toThrow();
    expect(() => validateBlockData("description", { segments: "pas un tableau" })).toThrow();
  });
});
