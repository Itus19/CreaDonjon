import { describe, expect, it } from "vitest";
import { dayPeriod, materializeOccupants } from "./occupants";
import { zSettlementBlockData, type SettlementBlockData } from "../schemas/blocks/settlement";

const ville: SettlementBlockData = {
  __v: 1,
  seed: 123_456,
  population: 2_000,
  zone: "ville",
  wealth: "correcte",
  biome: "temperate_deciduous_forest",
  peoples: [
    { key: "human", share: 70 },
    { key: "dwarf", share: 20 },
    { key: "halfling", share: 10 },
  ],
  trades: [
    { key: "farmer", share: 50 },
    { key: "smith", share: 10 },
    { key: "merchant", share: 20 },
  ],
};
const auberge = { key: "entite-auberge-1", type: "inn" as const };
const soir = { day: 3, hour: 20 };

describe("dayPeriod", () => {
  it("découpe la journée en quatre moments", () => {
    expect(dayPeriod(0)).toBe("night");
    expect(dayPeriod(5)).toBe("night");
    expect(dayPeriod(6)).toBe("morning");
    expect(dayPeriod(12)).toBe("afternoon");
    expect(dayPeriod(18)).toBe("evening");
    expect(dayPeriod(23)).toBe("evening");
  });

  it("refuse une heure hors de 0 à 23", () => {
    expect(() => dayPeriod(24)).toThrow(RangeError);
    expect(() => dayPeriod(-1)).toThrow(RangeError);
  });
});

describe("materializeOccupants — auberge", () => {
  it("rend exactement le même résultat pour la même ville, le même lieu et le même moment", () => {
    expect(materializeOccupants(ville, auberge, soir)).toEqual(materializeOccupants(ville, auberge, soir));
  });

  it("place toujours un seul aubergiste, en tête, avec son métier", () => {
    const occupants = materializeOccupants(ville, auberge, soir);
    const aubergistes = occupants.filter((o) => o.role === "innkeeper");
    expect(aubergistes).toHaveLength(1);
    expect(occupants[0]).toMatchObject({ role: "innkeeper", rank: 0, trade: "innkeeper" });
  });

  it("garde le même aubergiste et le même personnel à toute heure et tout jour", () => {
    const fixes = (day: number, hour: number) =>
      materializeOccupants(ville, auberge, { day, hour }).filter((o) => o.role !== "patron");
    expect(fixes(1, 8)).toEqual(fixes(9, 21));
  });

  it("compte entre 1 et 3 membres du personnel, borné par la richesse", () => {
    for (let seed = 0; seed < 50; seed++) {
      const modeste = materializeOccupants({ ...ville, seed, wealth: "modeste" }, auberge, soir);
      const reputee = materializeOccupants({ ...ville, seed, wealth: "reputee" }, auberge, soir);
      expect(modeste.filter((o) => o.role === "staff")).toHaveLength(1);
      const staff = reputee.filter((o) => o.role === "staff").length;
      expect(staff).toBeGreaterThanOrEqual(1);
      expect(staff).toBeLessThanOrEqual(3);
    }
  });

  it("numérote les rangs de chaque rôle à partir de 0, sans trou", () => {
    const occupants = materializeOccupants({ ...ville, wealth: "reputee", zone: "capitale" }, auberge, soir);
    for (const role of ["staff", "patron"] as const) {
      const ranks = occupants.filter((o) => o.role === role).map((o) => o.rank);
      expect(ranks).toEqual(ranks.map((_, i) => i));
    }
  });

  it("fait varier les clients avec le jour, mais les redonne pour le même soir", () => {
    const clients = (day: number) =>
      materializeOccupants(ville, auberge, { day, hour: 20 }).filter((o) => o.role === "patron");
    expect(clients(3)).toEqual(clients(3));
    const seeds = new Set([1, 2, 3, 4, 5].map((day) => JSON.stringify(clients(day).map((c) => c.seed))));
    expect(seeds.size).toBeGreaterThan(1);
  });

  it("a plus de clients le soir que la nuit, et plus dans une capitale que dans un bourg", () => {
    let soirTotal = 0;
    let nuitTotal = 0;
    let capitaleTotal = 0;
    let bourgTotal = 0;
    for (let day = 0; day < 40; day++) {
      const compte = (s: SettlementBlockData, hour: number) =>
        materializeOccupants(s, auberge, { day, hour }).filter((o) => o.role === "patron").length;
      soirTotal += compte(ville, 20);
      nuitTotal += compte(ville, 3);
      capitaleTotal += compte({ ...ville, zone: "capitale" }, 20);
      bourgTotal += compte({ ...ville, zone: "bourg" }, 20);
    }
    expect(soirTotal).toBeGreaterThan(nuitTotal);
    expect(capitaleTotal).toBeGreaterThan(bourgTotal);
  });

  it("tire le peuple selon les proportions de la ville", () => {
    const compte: Record<string, number> = {};
    for (let seed = 0; seed < 300; seed++) {
      for (const o of materializeOccupants({ ...ville, seed }, auberge, soir)) {
        if (o.people) compte[o.people] = (compte[o.people] ?? 0) + 1;
      }
    }
    expect(Object.keys(compte).sort()).toEqual(["dwarf", "halfling", "human"]);
    expect(compte.human).toBeGreaterThan(compte.dwarf);
    expect(compte.dwarf).toBeGreaterThan(compte.halfling);
  });

  it("donne aux clients un métier de la ville, et laisse peuple et métier vides quand la ville n'en dit rien", () => {
    const clients = materializeOccupants(ville, auberge, soir).filter((o) => o.role === "patron");
    for (const c of clients) expect(["farmer", "smith", "merchant"]).toContain(c.trade);

    const muette = materializeOccupants({ ...ville, peoples: [], trades: [] }, auberge, soir);
    for (const o of muette) expect(o.people).toBeNull();
    for (const o of muette.filter((x) => x.role === "patron")) expect(o.trade).toBeNull();
  });

  it("donne à chaque occupant une graine propre et distincte", () => {
    const occupants = materializeOccupants({ ...ville, zone: "capitale", wealth: "reputee" }, auberge, soir);
    expect(new Set(occupants.map((o) => o.seed)).size).toBe(occupants.length);
  });

  it("ne peuple pas un lieu d'une ville sans habitants", () => {
    expect(materializeOccupants({ ...ville, population: 0 }, auberge, soir)).toEqual([]);
  });

  it("donne d'autres gens à une autre auberge de la même ville", () => {
    const ici = materializeOccupants(ville, auberge, soir);
    const ailleurs = materializeOccupants(ville, { key: "entite-auberge-2", type: "inn" }, soir);
    expect(ailleurs[0].seed).not.toBe(ici[0].seed);
  });
});

describe("zSettlementBlockData", () => {
  it("accepte la ville d'exemple", () => {
    expect(zSettlementBlockData.parse(ville)).toEqual(ville);
  });

  it("met des listes vides par défaut", () => {
    const sansListes: Record<string, unknown> = { ...ville };
    delete sansListes.peoples;
    delete sansListes.trades;
    expect(zSettlementBlockData.parse(sansListes)).toMatchObject({ peoples: [], trades: [] });
  });

  it("refuse un biome, une zone ou une richesse inconnus", () => {
    expect(() => zSettlementBlockData.parse({ ...ville, biome: "jungle" })).toThrow();
    expect(() => zSettlementBlockData.parse({ ...ville, zone: "hameau" })).toThrow();
    expect(() => zSettlementBlockData.parse({ ...ville, wealth: "riche" })).toThrow();
  });

  it("refuse une graine hors de 32 bits et une population négative", () => {
    expect(() => zSettlementBlockData.parse({ ...ville, seed: 2 ** 32 })).toThrow();
    expect(() => zSettlementBlockData.parse({ ...ville, population: -1 })).toThrow();
  });

  it("refuse un peuple ou un métier en double, et un poids nul", () => {
    expect(() =>
      zSettlementBlockData.parse({ ...ville, peoples: [{ key: "human", share: 1 }, { key: "human", share: 2 }] })
    ).toThrow();
    expect(() => zSettlementBlockData.parse({ ...ville, trades: [{ key: "smith", share: 0 }] })).toThrow();
  });
});
