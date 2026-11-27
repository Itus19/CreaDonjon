import { describe, expect, it } from "vitest";
import type { StatblockBlockData } from "../schemas/blocks/statblock";
import type { InventoryBlockData } from "../schemas/blocks/inventory";
import { isFacetKey, playerViewOfInventory, playerViewOfStatblock, seenAtAGlance } from "./facets";

const FICHE: StatblockBlockData = {
  __v: 1,
  size: "Medium",
  creature_type: "Humanoid",
  ac: { value: 12, source: "armure de cuir" },
  hp: { value: 9, hit_dice: "2d8" },
  speed: "9 m",
  abilities: { str: 14, dex: 11, con: 12, int: 9, wis: 10, cha: 13 },
  skills: { Perception: 2 },
  traits: [{ name: "Robuste", text: "secret de trait" }],
  actions: [{ name: "Gourdin", text: "+4 au toucher" }],
  reactions: [],
  legendary_actions: [],
  based_on: { source: "srd-2024", key: "tough" },
};

const SAC: InventoryBlockData = {
  __v: 1,
  items: [
    { id: "pnj-0", qty: 1, equipped: true, label: "Tablier" },
    { id: "pnj-1", qty: 1, equipped: true, concealed: true, ref: { kind: "rule", key: "dagger" } },
    { id: "pnj-2", qty: 1, label: "Lettre pliée" },
  ],
  containers: [],
  currency: { pp: 0, gp: 3, ep: 0, sp: 4, cp: 2 },
};

describe("isFacetKey", () => {
  it("accepte les formes prévues, refuse le reste", () => {
    for (const ok of ["ability:str", "ac", "hp", "speed", "purse", "item:pnj-1", "action:0", "trait:2"]) expect(isFacetKey(ok), ok).toBe(true);
    for (const ko of ["ability:force", "item:", "ac:1", "PURSE", "skill:Perception; drop table", "action:-1"]) expect(isFacetKey(ko), ko).toBe(false);
  });
});

describe("playerViewOfStatblock — rien de ce qui n'est pas découvert ne part", () => {
  it("sans indice : une vue vide, et aucune valeur de la fiche dans le JSON", () => {
    const vue = playerViewOfStatblock(FICHE, new Set());
    expect(vue).toEqual({ abilities: {}, actions: [], traits: [] });
    const json = JSON.stringify(vue);
    for (const secret of ["14", "12", "armure", "Gourdin", "Robuste", "tough", "2d8"]) expect(json).not.toContain(secret);
  });

  it("la Force découverte, et seulement elle", () => {
    expect(playerViewOfStatblock(FICHE, new Set(["ability:str"]))).toEqual({ abilities: { str: 14 }, actions: [], traits: [] });
  });

  it("CA, PV, vitesse, une action, un trait", () => {
    const vue = playerViewOfStatblock(FICHE, new Set(["ac", "hp", "speed", "action:0", "trait:0"]));
    expect(vue).toEqual({
      abilities: {},
      ac: 12,
      hp: 9,
      speed: "9 m",
      actions: [{ name: "Gourdin", text: "+4 au toucher" }],
      traits: [{ name: "Robuste", text: "secret de trait" }],
    });
  });
});

describe("playerViewOfInventory", () => {
  it("sans indice : ni objet ni bourse", () => {
    const vue = playerViewOfInventory(SAC, new Set());
    expect(vue).toEqual({ items: [] });
    expect(JSON.stringify(vue)).not.toMatch(/Tablier|dagger|Lettre|"gp"/);
  });

  it("les objets découverts, la bourse si elle l'est", () => {
    const vue = playerViewOfInventory(SAC, new Set(["item:pnj-1", "purse"]));
    expect(vue.items.map((i) => i.id)).toEqual(["pnj-1"]);
    expect(vue.currency).toEqual(SAC.currency);
  });

  it("une vue ne porte jamais le drapeau « caché » ni les notes", () => {
    const sac = { ...SAC, items: [{ ...SAC.items[1], notes: "volé à un garde" }] };
    expect(JSON.stringify(playerViewOfInventory(sac, new Set(["item:pnj-1"])))).not.toMatch(/concealed|volé/);
  });
});

describe("seenAtAGlance — ce qui se voit dès qu'on voit le PNJ", () => {
  it("les objets portés et non cachés", () => {
    expect(seenAtAGlance(SAC)).toEqual(["item:pnj-0"]);
  });
});
