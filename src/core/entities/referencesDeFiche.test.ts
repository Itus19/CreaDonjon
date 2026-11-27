import { describe, expect, it } from "vitest";
import { referencesDeFiche } from "./referencesDeFiche";

describe("referencesDeFiche (V3.2-72)", () => {
  it("un personnage cite son espèce, son historique, ses classes et sous-classes", () => {
    const data = {
      __v: 1,
      species: { kind: "rule", key: "human" },
      background: { kind: "rule", key: "soldier" },
      classes: [{ class: { kind: "rule", key: "fighter" }, level: 3, subclass: { kind: "rule", key: "champion" } }],
      abilities: { method: "standard_array", base: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 } },
      choices: {},
      hp_method: "fixed",
      portrait_asset_id: null,
    };
    expect(referencesDeFiche("character", data)).toEqual({ ruleKeys: ["human", "soldier", "fighter", "champion"], entityIds: [] });
  });

  it("un inventaire cite ses objets de règle et ses objets-fiches, pas ses objets en ligne", () => {
    const data = {
      __v: 1,
      items: [
        { id: "a", qty: 1, ref: { kind: "rule", key: "greatsword" } },
        { id: "b", qty: 1, ref: { kind: "entity", id: "e-1" } },
        { id: "c", qty: 2, label: "Corde" },
      ],
      containers: [],
      currency: { pp: 0, gp: 3, ep: 0, sp: 0, cp: 0 },
    };
    expect(referencesDeFiche("inventory", data)).toEqual({ ruleKeys: ["greatsword"], entityIds: ["e-1"] });
  });

  it("une donnée illisible ne cite rien", () => {
    expect(referencesDeFiche("spellcasting", { n: 1 })).toEqual({ ruleKeys: [], entityIds: [] });
    expect(referencesDeFiche("text", {})).toEqual({ ruleKeys: [], entityIds: [] });
  });
});
