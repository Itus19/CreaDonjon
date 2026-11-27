import { describe, expect, it } from "vitest";
import { ARCHETYPES_DE_DEPART } from "../worldgen/archetypes";
import { zStatblockBlockData, type StatblockBlockData } from "../schemas/blocks/statblock";
import { NPC_SHEET_BY_ARCHETYPE, NPC_SHEET_KEYS, npcSheetFrom, npcSheetKey } from "./npcSheet";

/** Le Roturier du SRD 2024, tel que `statblockFromMonsterBlocks` le rend. */
const ROTURIER: StatblockBlockData = {
  __v: 1,
  size: "Medium",
  creature_type: "Humanoid",
  ac: { value: 10 },
  hp: { value: 4, hit_dice: "1d8" },
  speed: "30 ft.",
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  traits: [],
  actions: [{ name: "Club", text: "Melee Attack Roll: +2, reach 5 ft. Hit: 2 (1d4) Bludgeoning damage." }],
  reactions: [],
  legendary_actions: [],
};

describe("npcSheetKey — la fiche du SRD d'après l'archétype de vie", () => {
  it("chaque archétype de départ a sa fiche, et c'est une fiche connue", () => {
    for (const archetype of ARCHETYPES_DE_DEPART) {
      const key = NPC_SHEET_BY_ARCHETYPE[archetype.key];
      expect(key, archetype.key).toBeDefined();
      expect(NPC_SHEET_KEYS).toContain(key);
    }
  });

  it("un garde est un Garde, un pilier de bar un Gros-bras", () => {
    expect(npcSheetKey("garde")).toEqual({ key: "guard", fallback: false });
    expect(npcSheetKey("pilier_de_bar")).toEqual({ key: "tough", fallback: false });
  });

  it("sans archétype, ou avec un archétype inconnu, c'est un Roturier, et on le dit", () => {
    expect(npcSheetKey(undefined)).toEqual({ key: "commoner", fallback: true });
    expect(npcSheetKey("dragonnier")).toEqual({ key: "commoner", fallback: true });
  });
});

describe("npcSheetFrom — la fiche ajustée, à graine fixe", () => {
  it("même base, même archétype, même graine : même fiche", () => {
    const a = npcSheetFrom(ROTURIER, { templateKey: "commoner", archetype: "artisan", seed: 42 });
    const b = npcSheetFrom(ROTURIER, { templateKey: "commoner", archetype: "artisan", seed: 42 });
    expect(a).toEqual(b);
  });

  it("garde la fiche du SRD dont elle part, et reste un bloc valide", () => {
    const sheet = npcSheetFrom(ROTURIER, { templateKey: "commoner", archetype: "artisan", seed: 7 });
    expect(sheet.based_on).toEqual({ source: "srd-2024", key: "commoner" });
    expect(zStatblockBlockData.parse(sheet)).toEqual(sheet);
  });

  it("une artisane a plus de Force qu'un Roturier de base, quelle que soit la graine", () => {
    for (let seed = 0; seed < 50; seed++) {
      const sheet = npcSheetFrom(ROTURIER, { templateKey: "commoner", archetype: "artisan", seed });
      expect(sheet.abilities.str).toBeGreaterThan(ROTURIER.abilities.str);
    }
  });

  it("un enfant est plus faible, un vieillard plus sage", () => {
    for (let seed = 0; seed < 50; seed++) {
      expect(npcSheetFrom(ROTURIER, { templateKey: "commoner", archetype: "enfant", seed }).abilities.str).toBeLessThan(10);
      expect(npcSheetFrom(ROTURIER, { templateKey: "commoner", archetype: "vieillard", seed }).abilities.wis).toBeGreaterThan(10);
    }
  });

  it("sans métier, les écarts restent d'un point au plus", () => {
    for (let seed = 0; seed < 200; seed++) {
      const sheet = npcSheetFrom(ROTURIER, { templateKey: "commoner", seed });
      for (const value of Object.values(sheet.abilities)) expect(Math.abs(value - 10)).toBeLessThanOrEqual(1);
    }
  });

  it("les PV se tirent sur les dés de vie de la fiche, jamais sous 1", () => {
    const seen = new Set<number>();
    for (let seed = 0; seed < 200; seed++) {
      const hp = npcSheetFrom(ROTURIER, { templateKey: "commoner", seed }).hp;
      expect(hp.value).toBeGreaterThanOrEqual(1);
      expect(hp.value).toBeLessThanOrEqual(8);
      expect(hp.hit_dice).toBe("1d8");
      seen.add(hp.value);
    }
    expect(seen.size).toBeGreaterThan(4);
  });

  it("des dés de vie illisibles gardent les PV de la fiche", () => {
    const base = { ...ROTURIER, hp: { value: 9, hit_dice: "beaucoup" } };
    expect(npcSheetFrom(base, { templateKey: "commoner", seed: 3 }).hp.value).toBe(9);
  });

  it("le bonus de constitution compte dans les PV tirés (2d8+2 : de 4 à 18)", () => {
    const garde = { ...ROTURIER, hp: { value: 11, hit_dice: "2d8+2" } };
    for (let seed = 0; seed < 100; seed++) {
      const hp = npcSheetFrom(garde, { templateKey: "guard", seed }).hp.value;
      expect(hp).toBeGreaterThanOrEqual(4);
      expect(hp).toBeLessThanOrEqual(18);
    }
  });
});
