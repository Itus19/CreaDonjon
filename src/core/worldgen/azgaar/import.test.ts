import { describe, expect, it } from "vitest";
import { azgaarToAbstractWorld, zAzgaarExport } from "./import";
import { zAbstractWorld } from "../world";
import { simulateHistory } from "../history/simulate";

/** Un export Azgaar minuscule, de la même forme que le vrai (specs/generation-du-monde.md §8.1). */
function petiteCarte() {
  const cell = (i: number, biome: number, burg: number) => ({ i, biome, burg });
  return {
    info: { version: "1.159.0", seed: "936788045", mapName: "Essai", width: 100, height: 100 },
    settings: { populationRate: 1000, distanceScale: 4, options: { map: { lore: { calendar: { year: 355, era: "Ère d'essai" } } } } },
    pack: {
      cells: [cell(0, 0, 0), cell(1, 6, 1), cell(2, 6, 0), cell(3, 4, 2), cell(4, 12, 3), cell(5, 6, 4)],
      cultures: [
        { i: 0, name: "Wildlands" },
        { i: 1, name: "Granois" },
        { i: 2, name: "Vriens", removed: true },
      ],
      burgs: [
        0,
        { i: 1, name: "Hornver", cell: 1, x: 10, y: 10, state: 1, culture: 1, capital: 1, population: 48.739, group: "capital" },
        { i: 2, name: "Ostral", cell: 3, x: 40, y: 10, state: 2, culture: 1, capital: 1, population: 4.2, group: "town" },
        { i: 3, name: "Gué-Salé", cell: 4, x: 40, y: 40, state: 0, culture: 0, capital: 0, population: 0.45, group: "village" },
        { i: 4, name: "Ruine", cell: 5, x: 0, y: 0, state: 1, culture: 1, capital: 0, population: 1, removed: true },
      ],
      states: [
        { i: 0, name: "Neutrals" },
        { i: 1, name: "Grania", capital: 1, culture: 1 },
        { i: 2, name: "Vriia", capital: 2, culture: 2 },
        { i: 3, name: "Disparu", capital: 4, culture: 1, removed: true },
      ],
      routes: [
        { i: 0, group: "roads", points: [[10, 10, 1], [25, 10, 2], [40, 10, 3]] },
        { i: 1, group: "trails", points: [[40, 10, 3], [40, 40, 4]] },
        { i: 2, group: "searoutes", points: [[10, 10, 1], [40, 10, 3]] },
      ],
      events: [
        { i: 0, type: "war", name: "Guerre de la Frontière", start: "349", end: "351", attackers: [2], defenders: [1] },
        { i: 1, type: "war", name: "Guerre en cours", start: "354", attackers: [1], defenders: [2, 3] },
        { i: 2, type: "vassalage", name: "Vassalité", start: "330", suzerain: 1, vassal: 2 },
      ],
    },
  };
}

describe("azgaarToAbstractWorld", () => {
  const world = azgaarToAbstractWorld(zAzgaarExport.parse(petiteCarte()));

  it("rend un monde abstrait valide", () => {
    expect(() => zAbstractWorld.parse(world)).not.toThrow();
  });

  it("reprend la graine de la carte et l'année du calendrier comme présent", () => {
    expect(world.seed).toBe(936_788_045);
    expect(world.presentYear).toBe(355);
  });

  it("ignore la culture « Wildlands », l'État « Neutrals » et tout ce qui est retiré", () => {
    expect(world.cultures.map((c) => c.name)).toEqual(["Granois"]);
    expect(world.states.map((s) => s.name)).toEqual(["Grania", "Vriia"]);
    expect(world.sites.map((s) => s.name)).toEqual(["Hornver", "Ostral", "Gué-Salé"]);
  });

  it("rattache une ville libre à aucun État, et oublie un peuple retiré", () => {
    const gue = world.sites.find((s) => s.name === "Gué-Salé");
    expect(gue).toMatchObject({ stateId: null, cultureId: null });
    expect(world.states.find((s) => s.name === "Vriia")?.cultureId).toBeNull();
  });

  it("convertit la population, le biome de la cellule et le rang de la ville", () => {
    const hornver = world.sites.find((s) => s.name === "Hornver")?.settlement;
    expect(hornver).toMatchObject({ population: 48_739, biome: "temperate_deciduous_forest", zone: "capitale", wealth: "reputee" });
    const ostral = world.sites.find((s) => s.name === "Ostral")?.settlement;
    expect(ostral).toMatchObject({ population: 4_200, biome: "grassland", zone: "capitale", wealth: "correcte" });
    const gue = world.sites.find((s) => s.name === "Gué-Salé")?.settlement;
    expect(gue).toMatchObject({ population: 450, biome: "wetland", zone: "bourg", wealth: "modeste" });
  });

  it("donne à chaque ville une graine propre et stable", () => {
    const seeds = world.sites.map((s) => s.settlement.seed);
    expect(new Set(seeds).size).toBe(seeds.length);
    expect(azgaarToAbstractWorld(zAzgaarExport.parse(petiteCarte())).sites.map((s) => s.settlement.seed)).toEqual(seeds);
  });

  it("relie les villes qui se suivent sur une route, en kilomètres, sans doublon, en gardant la plus courte", () => {
    expect(world.links).toEqual([
      { a: "b-1", b: "b-2", distanceKm: 120, kind: "road" },
      { a: "b-2", b: "b-3", distanceKm: 120, kind: "trail" },
    ]);
  });

  it("garde les guerres comme événements imposés, en ne gardant que les États qui existent", () => {
    expect(world.anchors).toEqual([
      { type: "war", id: "e-0", name: "Guerre de la Frontière", startYear: 349, endYear: 351, attackers: ["s-2"], defenders: ["s-1"] },
      { type: "war", id: "e-1", name: "Guerre en cours", startYear: 354, endYear: null, attackers: ["s-1"], defenders: ["s-2"] },
    ]);
  });

  it("fait tourner l'histoire sur la carte importée", () => {
    const chronicle = simulateHistory(world, { years: 300 });
    expect(chronicle.presentYear).toBe(355);
    expect(chronicle.events.some((e) => e.kind === "war" && e.imposed && e.endYear === null)).toBe(true);
  });
});

describe("zAzgaarExport", () => {
  it("refuse un fichier qui n'est pas un export complet d'Azgaar", () => {
    expect(() => zAzgaarExport.parse({ info: { version: "1.159.0" } })).toThrow();
    const sansCellules = petiteCarte() as { pack: Record<string, unknown> };
    delete sansCellules.pack.cells;
    expect(() => zAzgaarExport.parse(sansCellules)).toThrow();
  });

  it("refuse une version d'Azgaar qu'on ne sait pas lire", () => {
    const vieille = petiteCarte();
    vieille.info.version = "1.89.0";
    expect(() => azgaarToAbstractWorld(zAzgaarExport.parse(vieille))).toThrow(/version/);
  });
});
