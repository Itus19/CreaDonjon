import { z } from "zod";
import type { Biome } from "../worldgen/biomes";

/**
 * Le climat d'un lieu (specs/meteo.md §3, ADR 0116) : ce que `weatherAt`
 * prend en entrée. Jamais lu dans une carte fixe : chaque partie a son
 * monde et sa carte, et le climat vient des fiches de CE monde (§2.6).
 */
export type Climate = {
  /** Température moyenne annuelle, en °C. */
  meanTempC: number;
  /** Écart entre la moyenne annuelle et le cœur de l'été (ou de l'hiver), en °C. */
  seasonalAmplitudeC: number;
  /** Humidité relative, de 0 (désert) à 100 (forêt pluvieuse). */
  humidity: number;
  /** Degrés, négatifs au sud : donne l'hémisphère et la saison des pluies sous les tropiques. */
  latitude: number;
  coastal: boolean;
};

/**
 * Le climat importé de la carte, posé sur le bloc `settlement` (ME-7).
 * Tous les champs sont facultatifs : ce qui manque vient du biome. Ce sont
 * des faits de la carte, pas des valeurs calculées (règle absolue 16).
 */
export const zSettlementClimate = z.object({
  mean_temp_c: z.number().min(-60).max(60).optional(),
  precipitation: z.number().min(0).max(100).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  elevation_m: z.number().min(-500).max(9000).optional(),
  coastal: z.boolean().optional(),
});
export type SettlementClimate = z.infer<typeof zSettlementClimate>;

type BiomeNormal = { meanTempC: number; amplitudeC: number; humidity: number };

/**
 * Normales grossières des treize biomes d'Azgaar, pour ce que la carte ne
 * dit pas. Ordres de grandeur terrestres, pas des mesures : elles servent à
 * ce qu'une taïga soit froide et un désert sec, rien de plus fin.
 */
export const BIOME_NORMALS: Record<Biome, BiomeNormal> = {
  marine: { meanTempC: 14, amplitudeC: 5, humidity: 70 },
  hot_desert: { meanTempC: 26, amplitudeC: 8, humidity: 5 },
  cold_desert: { meanTempC: 6, amplitudeC: 16, humidity: 10 },
  savanna: { meanTempC: 25, amplitudeC: 3, humidity: 40 },
  grassland: { meanTempC: 10, amplitudeC: 12, humidity: 40 },
  tropical_seasonal_forest: { meanTempC: 25, amplitudeC: 3, humidity: 60 },
  temperate_deciduous_forest: { meanTempC: 11, amplitudeC: 9, humidity: 55 },
  tropical_rainforest: { meanTempC: 26, amplitudeC: 1, humidity: 90 },
  temperate_rainforest: { meanTempC: 10, amplitudeC: 6, humidity: 85 },
  taiga: { meanTempC: -2, amplitudeC: 18, humidity: 45 },
  tundra: { meanTempC: -10, amplitudeC: 16, humidity: 30 },
  glacier: { meanTempC: -20, amplitudeC: 12, humidity: 20 },
  wetland: { meanTempC: 12, amplitudeC: 8, humidity: 80 },
};

/** Le climat par défaut d'un monde, tant que ses lieux n'ont pas de climat (§3.3). */
export type WorldClimateDefault = { biome: Biome; latitude: number };
export const DEFAULT_WORLD_CLIMATE: WorldClimateDefault = { biome: "temperate_deciduous_forest", latitude: 45 };

/** Refroidissement avec l'altitude, °C par mètre (gradient moyen de l'atmosphère). */
const LAPSE_RATE = 0.0065;
/** La mer adoucit les saisons. */
const COASTAL_DAMPING = 0.6;

/**
 * Le climat d'un lieu, de la source la plus précise à la plus grossière :
 * le climat importé de la carte, puis les normales du biome, puis le climat
 * par défaut du monde (specs/meteo.md §3).
 *
 * L'altitude ne rafraîchit que les normales du biome : une température
 * importée d'Azgaar tient déjà compte du relief.
 */
export function climateOf(
  settlement: { biome?: Biome; climate?: SettlementClimate } | null,
  fallback: WorldClimateDefault
): Climate {
  const imported = settlement?.climate ?? {};
  const normal = BIOME_NORMALS[settlement?.biome ?? fallback.biome];
  const latitude = imported.latitude ?? fallback.latitude;
  const coastal = imported.coastal ?? false;

  const meanTempC = imported.mean_temp_c ?? normal.meanTempC - LAPSE_RATE * Math.max(0, imported.elevation_m ?? 0);
  const humidity = imported.precipitation ?? normal.humidity;

  // Avec une latitude importée, l'amplitude suit la distance à l'équateur ;
  // sinon, celle du biome fait foi (il dit déjà « continental » ou « tropical »).
  const rawAmplitude = imported.latitude === undefined ? normal.amplitudeC : Math.min(22, Math.max(1, 0.32 * Math.abs(latitude) - 1));
  const seasonalAmplitudeC = coastal ? rawAmplitude * COASTAL_DAMPING : rawAmplitude;

  return { meanTempC, seasonalAmplitudeC, humidity, latitude, coastal };
}
