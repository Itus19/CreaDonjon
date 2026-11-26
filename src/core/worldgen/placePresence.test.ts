import { describe, expect, it } from "vitest";
import { occupantId, occupantLabel, occupantRoom, placeTypeOf, presenceDiff, settlementOf } from "./placePresence";
import type { SettlementBlockData } from "../schemas/blocks/settlement";

const entry = (label: string, value: string) => ({ label, value });

describe("placeTypeOf (V3.2-31)", () => {
  it("lit l'entrée Type de l'infobox d'abord", () => {
    expect(placeTypeOf("Le Chaudron", [entry("Type", "Taverne")])).toBe("tavern");
    expect(placeTypeOf("L'auberge du Chaudron", [entry("type", "Temple")])).toBe("temple");
  });

  it("sinon le nom du lieu, accents et majuscules compris", () => {
    expect(placeTypeOf("L'Auberge du Chaudron", [])).toBe("inn");
    expect(placeTypeOf("Le marché aux poissons", [])).toBe("market");
    expect(placeTypeOf("La Forge de Brann", [])).toBe("workshop");
    expect(placeTypeOf("L'église Saint-Aubin", [])).toBe("temple");
  });

  it("ne confond pas un mot dans un autre, et rend null sans indice", () => {
    expect(placeTypeOf("Barbe-Grise", [])).toBeNull();
    expect(placeTypeOf("La plaine de Morn", [])).toBeNull();
  });
});

describe("settlementOf (V3.2-31)", () => {
  it("prend le bloc settlement le plus proche quand il existe", () => {
    const bloc: SettlementBlockData = { __v: 1, seed: 7, population: 3000, zone: "ville", wealth: "modeste", biome: "temperate_deciduous_forest", peoples: [], trades: [] };
    expect(settlementOf([{ id: "auberge", entries: [entry("Zone", "Capitale")] }, { id: "ville", entries: [], settlement: bloc }])).toBe(bloc);
  });

  it("déduit la ville des infobox du lieu et de ses parents, le plus proche d'abord", () => {
    const s = settlementOf([
      { id: "auberge", entries: [entry("Richesse", "Réputée")] },
      { id: "ville", entries: [entry("Population", "12 500 habitants"), entry("Richesse", "Modeste")] },
    ]);
    expect(s).toMatchObject({ population: 12_500, zone: "ville", wealth: "reputee" });
  });

  it("la zone donne une population, la population donne une zone", () => {
    expect(settlementOf([{ id: "c", entries: [entry("Zone", "Capitale")] }])).toMatchObject({ zone: "capitale", population: 50_000 });
    expect(settlementOf([{ id: "c", entries: [entry("Population", "300")] }])).toMatchObject({ zone: "bourg", population: 300 });
  });

  it("sans rien, un bourg de richesse correcte, et la graine vient de la ville", () => {
    const seul = settlementOf([{ id: "auberge", entries: [] }]);
    expect(seul).toMatchObject({ zone: "bourg", wealth: "correcte" });
    const a = settlementOf([{ id: "a1", entries: [] }, { id: "ville", entries: [entry("Zone", "Ville")] }]);
    const b = settlementOf([{ id: "a2", entries: [] }, { id: "ville", entries: [entry("Zone", "Ville")] }]);
    expect(a?.seed).toBe(b?.seed);
  });

  it("rend null sans lieu", () => {
    expect(settlementOf([])).toBeNull();
  });
});

describe("personnes calculées dans la scène (V3.2-31)", () => {
  it("un identifiant stable : l'entité du wiki, ou la graine", () => {
    expect(occupantId({ seed: 42 })).toBe("calc-42");
    expect(occupantId({ seed: 42, entityId: "mabelle" })).toBe("mabelle");
  });

  it("chez soi, une pièce à soi ; ailleurs, l'espace principal", () => {
    expect(occupantRoom({ role: "lodger", rank: 1 }, "home")).toBe("chambre 2");
    expect(occupantRoom({ role: "head", rank: 0 }, "home")).toBe("les quartiers du personnel");
    expect(occupantRoom({ role: "lodger", rank: 0 }, "tavern")).toBeNull();
    expect(occupantRoom({ role: "staff", rank: 0 }, "work")).toBeNull();
  });

  it("un libellé sans nom, du métier ou de l'archétype et de l'âge", () => {
    expect(occupantLabel({ role: "head", trade: "innkeeper", archetype: "personnel_de_lieu", ageBand: "adult" })).toBe("aubergiste, d'âge mûr");
    expect(occupantLabel({ role: "regular", trade: "smith", archetype: "pilier_de_bar", ageBand: "young" })).toBe("habitué·e, pilier de bar, jeune");
    expect(occupantLabel({ role: "passing", trade: null, archetype: "messager", ageBand: "elder" })).toBe("de passage, messager, âgé·e");
  });

  it("qui arrive et qui part entre deux heures", () => {
    expect(presenceDiff(["a", "b", "c"], ["b", "d"])).toEqual({ arrived: ["d"], left: ["a", "c"] });
    expect(presenceDiff(["a"], ["a"])).toEqual({ arrived: [], left: [] });
  });
});
