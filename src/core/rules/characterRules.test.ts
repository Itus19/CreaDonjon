import { describe, expect, it } from "vitest";
import type { CharacterRules } from "../schemas/rule-blocks/characterRules";
import { zCharacterRulesBlockData } from "../schemas/rule-blocks/characterRules";
import { checkMulticlassEntry, checkMulticlassPrerequisites, exceedsLevelCap, pointBuyCost, withinAbilityScoreCap } from "./characterRules";
import { computeEncumbrance } from "./encumbrance";

/** Les valeurs 2024, telles que l'import SRD les pose (data/srd/character-rules-2024.json). */
const REGLES_2024: CharacterRules = {
  level_cap: 20,
  ability_score_cap: 20,
  ability_generation: {
    standard_array: [15, 14, 13, 12, 10, 8],
    point_buy: { budget: 27, min: 8, max: 15, costs: { "8": 0, "9": 1, "10": 2, "11": 3, "12": 4, "13": 5, "14": 7, "15": 9 } },
    roll: { dice_count: 4, dice_faces: 6, keep_highest: 3, rolls: 6 },
  },
  encumbrance: { capacity_per_strength_lb: 15, tiers: [] },
  sell_ratio: 0.5,
};
const scores = (v: Partial<Record<"str" | "dex" | "con" | "int" | "wis" | "cha", number>>) => ({ str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8, ...v });

describe("le bloc character_rules (V3.1-115)", () => {
  it("valide les règles 2024", () => {
    expect(zCharacterRulesBlockData.safeParse(REGLES_2024).success).toBe(true);
  });
  it("refuse un achat de points dont une valeur n'a pas de coût", () => {
    const sansCout = { ...REGLES_2024, ability_generation: { point_buy: { budget: 27, min: 8, max: 15, costs: { "8": 0 } } } };
    expect(zCharacterRulesBlockData.safeParse(sansCout).success).toBe(false);
  });
});

describe("achat de points lu dans les règles", () => {
  it("coûte 27 pour 15/15/15/8/8/8 en 2024", () => {
    expect(pointBuyCost(scores({ str: 15, dex: 15, con: 15 }), REGLES_2024.ability_generation.point_buy!)).toBe(27);
  });
  it("une valeur hors des bornes du ruleset coûte l'infini", () => {
    expect(pointBuyCost(scores({ str: 16 }), REGLES_2024.ability_generation.point_buy!)).toBe(Infinity);
  });
  it("tout au plancher coûte 0 ; 15 coûte 9 et 14 coûte 7 (coût non linéaire)", () => {
    const pb = REGLES_2024.ability_generation.point_buy!;
    expect(pointBuyCost(scores({}), pb)).toBe(0);
    expect(pointBuyCost(scores({ str: 15 }), pb)).toBe(9);
    expect(pointBuyCost(scores({ str: 14 }), pb)).toBe(7);
  });
  it("une valeur sous le plancher coûte l'infini", () => {
    expect(pointBuyCost(scores({ str: 7 }), REGLES_2024.ability_generation.point_buy!)).toBe(Infinity);
  });
  it("une variante change les bornes et les coûts", () => {
    const variante = { budget: 30, min: 6, max: 16, costs: { "6": -2, "7": -1, "8": 0, "9": 1, "10": 2, "11": 3, "12": 4, "13": 5, "14": 7, "15": 9, "16": 12 } };
    expect(pointBuyCost(scores({ str: 16, dex: 6 }), variante)).toBe(10);
  });
});

describe("plafond de caractéristique", () => {
  it("un ruleset au plafond 15 refuse 16 à la création", () => {
    expect(withinAbilityScoreCap(scores({ str: 15 }), 15)).toBe(true);
    expect(withinAbilityScoreCap(scores({ str: 16 }), 15)).toBe(false);
  });
});

describe("plafond de niveau", () => {
  it("refuse un niveau total au-delà du plafond du ruleset", () => {
    expect(exceedsLevelCap(20, 20)).toBe(false);
    expect(exceedsLevelCap(21, 20)).toBe(true);
    expect(exceedsLevelCap(11, 10)).toBe(true);
  });
});

describe("entrée dans une nouvelle classe (règle 5e : la nouvelle ET chaque classe actuelle)", () => {
  const moine = { all: [{ ability: "dex" as const, min: 13 }, { ability: "wis" as const, min: 13 }] };
  const guerrier = { any: [{ ability: "str" as const, min: 13 }, { ability: "dex" as const, min: 13 }] };
  it("tout est rempli : rien à signaler", () => {
    const r = checkMulticlassEntry(
      [{ key: "monk", prerequisites: moine }, { key: "fighter", prerequisites: guerrier }],
      scores({ dex: 14, wis: 13 })
    );
    expect(r).toEqual({ met: true, failures: [] });
  });
  it("signale la classe dont le prérequis manque, avec ses conditions", () => {
    const r = checkMulticlassEntry(
      [{ key: "monk", prerequisites: moine }, { key: "fighter", prerequisites: guerrier }],
      scores({ dex: 12, wis: 13 })
    );
    expect(r.met).toBe(false);
    expect(r.failures.map((f) => f.classKey)).toEqual(["monk", "fighter"]);
    expect(r.failures[0].unmet).toEqual([{ ability: "dex", min: 13 }]);
  });
  it("la classe actuelle seule peut bloquer, même si la nouvelle est remplie", () => {
    const r = checkMulticlassEntry([{ key: "monk", prerequisites: moine }, { key: "wizard" }], scores({ dex: 10, wis: 14 }));
    expect(r.failures.map((f) => f.classKey)).toEqual(["monk"]);
  });
  it("une classe sans prérequis déclaré n'exige rien", () => {
    expect(checkMulticlassEntry([{ key: "wizard" }], scores({})).met).toBe(true);
  });
});

describe("prérequis de multiclassage", () => {
  it("toutes les conditions : Moine DEX 13 et SAG 13", () => {
    const moine = { all: [{ ability: "dex" as const, min: 13 }, { ability: "wis" as const, min: 13 }] };
    expect(checkMulticlassPrerequisites(moine, scores({ dex: 14, wis: 13 }))).toEqual({ met: true, unmet: [] });
    expect(checkMulticlassPrerequisites(moine, scores({ dex: 14, wis: 12 }))).toEqual({ met: false, unmet: [{ ability: "wis", min: 13 }] });
  });
  it("une condition parmi plusieurs : Guerrier FOR 13 ou DEX 13", () => {
    const guerrier = { any: [{ ability: "str" as const, min: 13 }, { ability: "dex" as const, min: 13 }] };
    expect(checkMulticlassPrerequisites(guerrier, scores({ dex: 13 })).met).toBe(true);
    expect(checkMulticlassPrerequisites(guerrier, scores({}))).toEqual({ met: false, unmet: guerrier.any });
  });
  it("sans prérequis déclarés : rien à remplir", () => {
    expect(checkMulticlassPrerequisites(undefined, scores({}))).toEqual({ met: true, unmet: [] });
  });
});

describe("charge lue dans les règles", () => {
  it("2024 : un Guerrier FOR 17 à 75 kg (≈ 165 lb) n'est pas encombré ; capacité 255 lb", () => {
    const r = computeEncumbrance(17, 165, REGLES_2024.encumbrance);
    expect(r.tier).toBe("none");
    expect(r.capacity).toBe(255);
    expect(r.speedPenalty).toBe(0);
  });
  it("la variante de 2014 garde ses deux paliers", () => {
    const variante2014 = {
      capacity_per_strength_lb: 15,
      tiers: [
        { above_per_strength_lb: 5, speed_penalty_ft: 10, disadvantage: [] },
        { above_per_strength_lb: 10, speed_penalty_ft: 20, disadvantage: ["str" as const, "dex" as const, "con" as const] },
      ],
    };
    expect(computeEncumbrance(17, 165, variante2014)).toMatchObject({ tier: "encumbered", speedPenalty: 10, disadvantageAbilities: [] });
    expect(computeEncumbrance(10, 101, variante2014)).toMatchObject({ tier: "heavily_encumbered", speedPenalty: 20, disadvantageAbilities: ["str", "dex", "con"] });
    expect(computeEncumbrance(10, 50, variante2014).tier).toBe("none");
  });
});
