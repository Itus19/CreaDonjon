import { describe, expect, it } from "vitest";
import { azgaarToAbstractWorld, zAzgaarExport } from "./import";
import { zAbstractWorld } from "../world";
import { simulateHistory } from "../history/simulate";
import { petiteCarte } from "./petiteCarte";

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
