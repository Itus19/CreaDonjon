import { describe, expect, it } from "vitest";
import { ATTACHED_MAX, attachedPeople, materializeOccupants, type OccupantPlaceType, type WikiWorker } from "./occupants";
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

const LIEUX: OccupantPlaceType[] = ["inn", "tavern", "temple", "market", "barracks", "workshop", "hermitage"];
const attaches = (s: SettlementBlockData, place: { key: string; type: OccupantPlaceType }, day: number, workers?: WikiWorker[]) =>
  attachedPeople(s, place, day, workers);
const presents = (s: SettlementBlockData, day: number, hour: number) => materializeOccupants(s, auberge, { day, hour });

describe("attachedPeople — les gens attachés à un lieu (V3.2-30)", () => {
  it("rend exactement les mêmes gens pour la même ville, le même lieu et le même jour", () => {
    expect(attaches(ville, auberge, 3)).toEqual(attaches(ville, auberge, 3));
  });

  it("garde le même personnel et les mêmes habitués d'un jour à l'autre", () => {
    const fixes = (day: number) => attaches(ville, auberge, day).filter((o) => ["head", "staff", "regular"].includes(o.role));
    expect(fixes(1)).toEqual(fixes(40));
    expect(fixes(1).some((o) => o.role === "regular")).toBe(true);
  });

  it("place un seul responsable, en tête, avec son métier et son archétype", () => {
    const gens = attaches(ville, auberge, 3);
    expect(gens.filter((o) => o.role === "head")).toHaveLength(1);
    expect(gens[0]).toMatchObject({ role: "head", rank: 0, trade: "innkeeper", archetype: "personnel_de_lieu" });
    expect(gens[0].places).toMatchObject({ home: auberge.key, work: auberge.key });
  });

  it("borne le personnel par la richesse", () => {
    for (let seed = 0; seed < 50; seed++) {
      const modeste = attaches({ ...ville, seed, wealth: "modeste" }, auberge, 3);
      const reputee = attaches({ ...ville, seed, wealth: "reputee" }, auberge, 3);
      expect(modeste.filter((o) => o.role === "staff")).toHaveLength(1);
      const staff = reputee.filter((o) => o.role === "staff").length;
      expect(staff).toBeGreaterThanOrEqual(1);
      expect(staff).toBeLessThanOrEqual(3);
    }
  });

  it("une cabane d'ermite n'a qu'une personne, une taverne de capitale au plus douze", () => {
    for (let day = 0; day < 30; day++) {
      expect(attaches(ville, { key: "cabane", type: "hermitage" }, day)).toHaveLength(1);
      for (const type of LIEUX) {
        expect(attaches({ ...ville, zone: "capitale", wealth: "reputee" }, { key: `l-${type}`, type }, day).length).toBeLessThanOrEqual(ATTACHED_MAX);
      }
    }
  });

  it("une auberge de bourg compte quatre à six personnes attachées, une taverne de capitale bien plus", () => {
    const bourg = attaches({ ...ville, zone: "bourg", wealth: "modeste" }, auberge, 3).length;
    expect(bourg).toBeGreaterThanOrEqual(4);
    expect(bourg).toBeLessThanOrEqual(6);
    expect(attaches({ ...ville, zone: "capitale", wealth: "reputee" }, { key: "t", type: "tavern" }, 3).length).toBeGreaterThan(bourg + 3);
  });

  it("une personne de passage arrive, reste son séjour, et repart", () => {
    const capitale = { ...ville, zone: "capitale" as const };
    const passants = Array.from({ length: 28 }, (_, d) => attaches(capitale, auberge, d))
      .flat()
      .filter((o) => o.role === "passing" || o.role === "lodger");
    expect(passants.length).toBeGreaterThan(0);
    for (const p of passants) {
      expect(p.stay).toBeDefined();
      const { fromDay, toDay } = p.stay!;
      expect(attaches(capitale, auberge, fromDay).some((o) => o.seed === p.seed)).toBe(true);
      expect(attaches(capitale, auberge, toDay).some((o) => o.seed === p.seed)).toBe(false);
      expect(attaches(capitale, auberge, fromDay - 1).some((o) => o.seed === p.seed)).toBe(false);
    }
  });

  it("d'une semaine à l'autre, ce ne sont pas les mêmes gens de passage", () => {
    const capitale = { ...ville, zone: "capitale" as const };
    const graines = (day: number) => attaches(capitale, auberge, day).filter((o) => o.stay).map((o) => o.seed);
    const semaine1 = new Set(Array.from({ length: 7 }, (_, d) => graines(d)).flat());
    const semaine2 = Array.from({ length: 7 }, (_, d) => graines(d + 7)).flat();
    expect(semaine2.some((g) => semaine1.has(g))).toBe(false);
  });

  it("un PNJ du wiki relié par works_at prend la place de l'occupant tiré de même rang", () => {
    const sans = attaches(ville, auberge, 3);
    const avec = attaches(ville, auberge, 3, [{ entityId: "mabelle" }, { entityId: "garcon" }]);
    expect(avec[0]).toMatchObject({ role: "head", entityId: "mabelle", archetype: "personnel_de_lieu" });
    expect(avec.find((o) => o.role === "staff" && o.rank === 0)?.entityId).toBe("garcon");
    expect(avec.filter((o) => o.role === "head" || o.role === "staff").length).toBe(sans.filter((o) => o.role === "head" || o.role === "staff").length);
  });

  it("un PNJ du wiki en surnombre s'ajoute au personnel, le wiki l'emporte sur le plafond", () => {
    const workers = Array.from({ length: 15 }, (_, i) => ({ entityId: `pnj-${i}` }));
    const gens = attaches({ ...ville, wealth: "modeste" }, auberge, 3, workers);
    expect(gens.filter((o) => o.entityId).length).toBe(15);
    expect(gens.filter((o) => !o.entityId)).toHaveLength(0);
  });

  it("une personne ancrée avec sa graine reprend exactement sa place, même habituée", () => {
    const sans = attaches(ville, auberge, 3);
    const habitue = sans.find((o) => o.role === "regular")!;
    const avec = attaches(ville, auberge, 3, [{ entityId: "bram", seed: habitue.seed }, { entityId: "mabelle" }]);
    expect(avec.find((o) => o.seed === habitue.seed)).toMatchObject({ role: "regular", entityId: "bram" });
    expect(avec[0]).toMatchObject({ role: "head", entityId: "mabelle" });
    expect(avec.length).toBe(sans.length);
  });

  it("une personne ancrée du personnel ne laisse pas sa place à un PNJ sans graine", () => {
    const sans = attaches({ ...ville, wealth: "reputee" }, auberge, 3);
    const tete = sans[0];
    const avec = attaches({ ...ville, wealth: "reputee" }, auberge, 3, [{ entityId: "mabelle" }, { entityId: "aubergiste-ancre", seed: tete.seed }]);
    expect(avec[0].entityId).toBe("aubergiste-ancre");
    expect(avec.find((o) => o.role === "staff" && o.rank === 0)?.entityId).toBe("mabelle");
  });

  it("un PNJ du wiki garde l'archétype écrit sur sa fiche", () => {
    const gens = attaches(ville, auberge, 3, [{ entityId: "mabelle", archetype: "noble" }]);
    expect(gens[0].archetype).toBe("noble");
  });

  it("tire le peuple selon les proportions de la ville", () => {
    const compte: Record<string, number> = {};
    for (let seed = 0; seed < 300; seed++) {
      for (const o of attaches({ ...ville, seed }, auberge, 3)) {
        if (o.people) compte[o.people] = (compte[o.people] ?? 0) + 1;
      }
    }
    expect(Object.keys(compte).sort()).toEqual(["dwarf", "halfling", "human"]);
    expect(compte.human).toBeGreaterThan(compte.dwarf);
    expect(compte.dwarf).toBeGreaterThan(compte.halfling);
  });

  it("laisse peuple et métier vides quand la ville n'en dit rien", () => {
    const muette = attaches({ ...ville, peoples: [], trades: [] }, auberge, 3);
    for (const o of muette) expect(o.people).toBeNull();
    for (const o of muette.filter((x) => x.role === "regular")) expect(o.trade).toBeNull();
  });

  it("donne à chaque personne une graine propre, et d'autres gens à une autre auberge", () => {
    const gens = attaches({ ...ville, zone: "capitale", wealth: "reputee" }, auberge, 3);
    expect(new Set(gens.map((o) => o.seed)).size).toBe(gens.length);
    expect(attaches(ville, { key: "entite-auberge-2", type: "inn" }, 3)[0].seed).not.toBe(gens[0].seed);
  });

  it("ne peuple pas un lieu d'une ville sans habitants", () => {
    expect(attaches({ ...ville, population: 0 }, auberge, 3)).toEqual([]);
    expect(materializeOccupants({ ...ville, population: 0 }, auberge, soir)).toEqual([]);
  });
});

describe("materializeOccupants — qui est là, à l'heure (V3.2-30)", () => {
  it("rend exactement le même résultat pour la même heure", () => {
    expect(presents(ville, 3, 20)).toEqual(presents(ville, 3, 20));
  });

  it("le hall du soir n'a pas les mêmes gens que celui du matin", () => {
    const graines = (hour: number) => presents(ville, 3, hour).map((o) => o.seed).sort().join();
    expect(graines(20)).not.toEqual(graines(8));
  });

  it("ne garde que les attachés dont la position est ce lieu, et chacun de ces attachés en est", () => {
    const seeds = new Set(attaches(ville, auberge, 3).map((o) => o.seed));
    for (const hour of [2, 9, 14, 20]) {
      for (const o of presents(ville, 3, hour).filter((x) => x.role !== "patron")) expect(seeds.has(o.seed)).toBe(true);
    }
  });

  it("l'aubergiste est là en journée, chez lui la nuit, c'est-à-dire à l'auberge", () => {
    let jours = 0;
    for (let day = 0; day < 30; day++) if (presents(ville, day, 14).some((o) => o.role === "head")) jours++;
    expect(jours).toBeGreaterThan(25);
  });

  it("a plus de clients d'un soir le soir que la nuit, et plus dans une capitale que dans un bourg", () => {
    let soir = 0;
    let nuit = 0;
    let capitale = 0;
    let bourg = 0;
    for (let day = 0; day < 40; day++) {
      const compte = (s: SettlementBlockData, hour: number) => presents(s, day, hour).filter((o) => o.role === "patron").length;
      soir += compte(ville, 20);
      nuit += compte(ville, 3);
      capitale += compte({ ...ville, zone: "capitale" }, 20);
      bourg += compte({ ...ville, zone: "bourg" }, 20);
    }
    expect(soir).toBeGreaterThan(nuit);
    expect(capitale).toBeGreaterThan(bourg);
  });

  it("un client d'un soir reste quelques heures d'affilée, puis s'en va", () => {
    const capitale = { ...ville, zone: "capitale" as const };
    const heures = new Map<number, number[]>();
    for (let hour = 0; hour < 24; hour++) {
      for (const o of presents(capitale, 5, hour).filter((x) => x.role === "patron")) heures.set(o.seed, [...(heures.get(o.seed) ?? []), hour]);
    }
    expect(heures.size).toBeGreaterThan(0);
    for (const h of heures.values()) {
      expect(h.length).toBeLessThanOrEqual(3);
      expect(h[h.length - 1] - h[0]).toBe(h.length - 1);
    }
  });

  it("donne aux clients d'un soir un métier de la ville", () => {
    for (const c of presents({ ...ville, zone: "capitale" }, 3, 20).filter((o) => o.role === "patron")) expect(["farmer", "smith", "merchant"]).toContain(c.trade);
  });

  it("refuse une heure hors de 0 à 23", () => {
    expect(() => presents(ville, 0, 24)).toThrow(RangeError);
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
