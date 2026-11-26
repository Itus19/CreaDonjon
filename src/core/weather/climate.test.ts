import { describe, expect, it } from "vitest";
import { BIOMES } from "../worldgen/biomes";
import { BIOME_NORMALS, climateOf, DEFAULT_WORLD_CLIMATE } from "./climate";

describe("BIOME_NORMALS", () => {
  it("couvre les treize biomes", () => {
    for (const biome of BIOMES) expect(BIOME_NORMALS[biome]).toBeDefined();
  });

  it("met le désert chaud plus chaud et plus sec que la toundra", () => {
    expect(BIOME_NORMALS.hot_desert.meanTempC).toBeGreaterThan(BIOME_NORMALS.tundra.meanTempC);
    expect(BIOME_NORMALS.hot_desert.humidity).toBeLessThan(BIOME_NORMALS.temperate_rainforest.humidity);
  });
});

describe("climateOf", () => {
  it("prend le climat importé de la carte quand il est là", () => {
    const c = climateOf({ biome: "grassland", climate: { mean_temp_c: 4, precipitation: 80, latitude: -40, elevation_m: 300, coastal: true } }, DEFAULT_WORLD_CLIMATE);
    expect(c.meanTempC).toBe(4);
    expect(c.humidity).toBe(80);
    expect(c.latitude).toBe(-40);
    expect(c.coastal).toBe(true);
  });

  it("complète un climat importé partiel par les normales du biome", () => {
    const c = climateOf({ biome: "hot_desert", climate: { latitude: 20 } }, DEFAULT_WORLD_CLIMATE);
    expect(c.meanTempC).toBe(BIOME_NORMALS.hot_desert.meanTempC);
    expect(c.humidity).toBe(BIOME_NORMALS.hot_desert.humidity);
    expect(c.latitude).toBe(20);
  });

  it("rafraîchit les normales du biome avec l'altitude, jamais une température importée", () => {
    const plaine = climateOf({ biome: "grassland", climate: { elevation_m: 0 } }, DEFAULT_WORLD_CLIMATE);
    const montagne = climateOf({ biome: "grassland", climate: { elevation_m: 2000 } }, DEFAULT_WORLD_CLIMATE);
    expect(montagne.meanTempC).toBeCloseTo(plaine.meanTempC - 13, 5);
    const importe = climateOf({ biome: "grassland", climate: { mean_temp_c: 3, elevation_m: 2000 } }, DEFAULT_WORLD_CLIMATE);
    expect(importe.meanTempC).toBe(3);
  });

  it("replie sur le climat par défaut du monde sans ville", () => {
    const c = climateOf(null, { biome: "taiga", latitude: 60 });
    expect(c.meanTempC).toBe(BIOME_NORMALS.taiga.meanTempC);
    expect(c.latitude).toBe(60);
  });

  it("garde l'amplitude saisonnière plus faible au bord de la mer", () => {
    const terre = climateOf({ biome: "grassland", climate: { latitude: 50, coastal: false } }, DEFAULT_WORLD_CLIMATE);
    const cote = climateOf({ biome: "grassland", climate: { latitude: 50, coastal: true } }, DEFAULT_WORLD_CLIMATE);
    expect(cote.seasonalAmplitudeC).toBeLessThan(terre.seasonalAmplitudeC);
  });

  it("donne une amplitude plus forte loin de l'équateur quand la latitude est importée", () => {
    const tropique = climateOf({ biome: "grassland", climate: { latitude: 10 } }, DEFAULT_WORLD_CLIMATE);
    const nord = climateOf({ biome: "grassland", climate: { latitude: 55 } }, DEFAULT_WORLD_CLIMATE);
    expect(nord.seasonalAmplitudeC).toBeGreaterThan(tropique.seasonalAmplitudeC);
  });
});
