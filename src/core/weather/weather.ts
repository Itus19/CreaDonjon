import { deriveSeed } from "../worldgen/seed";
import type { Climate } from "./climate";
import { seasonOf, type Season } from "./season";

/**
 * Le temps qu'il fait (specs/meteo.md §5, ADR 0116) : une fonction pure du
 * climat, de la position dans l'année, du jour et de l'heure, à graine
 * fixe. Rien n'est stocké ni simulé : revenir à midi le jour 12 redonne la
 * même averse.
 *
 * Trois couches : la normale du jour (climat et saison), des perturbations
 * lisses de quelques jours (les fronts), puis la journée (courbe de
 * température, averses, brouillard du matin).
 */

export const SKIES = ["clear", "hazy", "cloudy", "overcast"] as const;
export type Sky = (typeof SKIES)[number];
export const PRECIPITATIONS = ["none", "drizzle", "rain", "downpour", "thunderstorm", "snow", "sleet", "hail"] as const;
export type Precipitation = (typeof PRECIPITATIONS)[number];
export const WINDS = ["calm", "breeze", "wind", "gale"] as const;
export type Wind = (typeof WINDS)[number];
export const FEELS = ["freezing", "cold", "cool", "mild", "warm", "hot", "scorching"] as const;
export type Feel = (typeof FEELS)[number];

export type Weather = {
  sky: Sky;
  precipitation: Precipitation;
  wind: Wind;
  fog: boolean;
  /** Arrondi au degré. */
  temperatureC: number;
  feel: Feel;
  /** `null` quand le calendrier n'a pas de date réglée (§4.5). */
  season: Season | null;
};

export type WeatherInput = {
  climate: Climate;
  /** Position dans l'année (`yearPhase`), `null` sans date réglée : pas de saison. */
  phase: number | null;
  /** Compteur absolu des jours (celui de la scène), pour que les fronts s'enchaînent d'un jour à l'autre. */
  absoluteDay: number;
  hour: number;
  /** Dérivée de la graine de la ville (`deriveSeed(graine, "meteo")`), donc propre à chaque monde. */
  seed: number;
};

const TWO_PI = Math.PI * 2;

/**
 * Un nombre de [0, 1) attaché à un point entier de la grille du bruit.
 *
 * FNV-1a (`deriveSeed`) mélange mal deux clés qui ne diffèrent que par leur
 * dernier caractère (« 12 » et « 13 ») : les points voisins se
 * ressemblaient, et une année entière penchait d'un côté. Le finaliseur de
 * MurmurHash3 (trois multiplications, sans dépendance) disperse ces bits.
 */
function lattice(seed: number, layer: string, i: number): number {
  let h = deriveSeed(seed, layer, i);
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/**
 * Bruit de valeur à une dimension : des points tirés à graine fixe aux
 * entiers, reliés par une courbe douce. Continu, donc le temps glisse d'une
 * heure à l'autre au lieu de sauter.
 */
function valueNoise(seed: number, layer: string, x: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const t = f * f * (3 - 2 * f);
  return lattice(seed, layer, i) * (1 - t) + lattice(seed, layer, i + 1) * t;
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

function feelOf(t: number): Feel {
  if (t <= -5) return "freezing";
  if (t <= 5) return "cold";
  if (t <= 12) return "cool";
  if (t <= 20) return "mild";
  if (t <= 27) return "warm";
  if (t <= 35) return "hot";
  return "scorching";
}

export function weatherAt(input: WeatherInput): Weather {
  const { climate, phase, absoluteDay, hour, seed } = input;
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) throw new RangeError("L'heure va de 0 à 23");
  // Le temps continu, en jours : toutes les couches de bruit le lisent.
  const t = absoluteDay + hour / 24;

  // 1. La normale du jour. phase 0 = cœur de l'hiver (cos = 1, le plus froid).
  const seasonal = phase === null ? 0 : Math.cos(TWO_PI * phase);
  const tropical = Math.abs(climate.latitude) < 23.5;
  // Sous les tropiques, la saison joue sur la pluie : sèche en hiver, humide en été.
  const humidity = tropical && phase !== null ? Math.min(100, Math.max(0, climate.humidity * (1 - 0.7 * seasonal))) : climate.humidity;
  const h = humidity / 100;

  // 2. Les fronts : une période de quatre jours environ.
  const front = valueNoise(seed, "front", t / 4);
  const cloud = clamp01(0.85 * front + 0.6 * h - 0.28 + 0.2 * (valueNoise(seed, "cloud", t * 2) - 0.5));
  const anomaly = (valueNoise(seed, "temp", t / 5) - 0.5) * 10;

  // 3. La journée : minimum vers 3 h, maximum vers 15 h, écrasé par les nuages et la mer.
  const dailyRange = 9 * (1 - 0.5 * h) * (climate.coastal ? 0.7 : 1) * (1 - 0.6 * cloud);
  const diurnal = (dailyRange / 2) * Math.cos((TWO_PI * (hour - 15)) / 24);
  const temperature = climate.meanTempC - climate.seasonalAmplitudeC * seasonal + anomaly + diurnal;
  const temperatureC = Math.round(temperature);

  const sky: Sky = cloud < 0.2 ? "clear" : cloud < 0.45 ? "hazy" : cloud < 0.7 ? "cloudy" : "overcast";

  // Pluie : seulement sous un ciel chargé, plus probable quand l'air est humide.
  // La nature se décide sur la température affichée, pour que l'écran ne montre jamais de la neige à 2 °C.
  const wetness = clamp01((cloud - 0.6) / 0.4);
  const showers = valueNoise(seed, "rain", t * 3);
  const raining = wetness > 0 && showers < wetness * (0.5 + 0.9 * h);
  let precipitation: Precipitation = "none";
  if (raining) {
    const intensity = clamp01(wetness * 0.6 + 0.6 * (valueNoise(seed, "intensity", t * 4) - 0.4));
    if (temperatureC < 0) precipitation = "snow";
    else if (temperatureC < 2) precipitation = intensity > 0.5 ? "snow" : "sleet";
    else if (intensity > 0.8 && temperatureC >= 20 && humidity >= 40) precipitation = intensity > 0.97 ? "hail" : "thunderstorm";
    else if (intensity > 0.7) precipitation = "downpour";
    else if (intensity > 0.3) precipitation = "rain";
    else precipitation = "drizzle";
  }

  const gust = clamp01(0.7 * valueNoise(seed, "wind", t / 2) + 0.35 * front + (climate.coastal ? 0.12 : 0) - 0.15);
  let wind: Wind = gust < 0.3 ? "calm" : gust < 0.6 ? "breeze" : gust < 0.85 ? "wind" : "gale";
  if (precipitation === "thunderstorm" && (wind === "calm" || wind === "breeze")) wind = "wind";

  // Brouillard : le matin, par air humide et vent faible, un jour sur quelques-uns.
  const morning = hour >= 3 && hour <= 10;
  const fog =
    morning && (wind === "calm" || wind === "breeze") && precipitation === "none" && lattice(seed, "fog", Math.floor(absoluteDay)) < (humidity - 40) / 120;

  return {
    sky,
    precipitation,
    wind,
    fog,
    temperatureC: temperatureC === 0 ? 0 : temperatureC,
    feel: feelOf(temperatureC),
    season: phase === null ? null : seasonOf(phase),
  };
}

export type WeatherChange =
  | { kind: "precipitation_starts"; precipitation: Precipitation }
  | { kind: "precipitation_stops"; precipitation: Precipitation }
  | { kind: "precipitation_changes"; from: Precipitation; to: Precipitation }
  | { kind: "wind_rises"; wind: Wind }
  | { kind: "wind_drops"; wind: Wind }
  | { kind: "fog_forms" }
  | { kind: "fog_lifts" }
  | { kind: "colder"; temperatureC: number }
  | { kind: "warmer"; temperatureC: number }
  | { kind: "sky_changes"; sky: Sky };

/** Écart de température qui mérite d'être dit. */
const NOTABLE_DELTA_C = 5;
/** Au plus deux faits par tour : la ligne du tour et le prompt restent courts (§5.3). */
const MAX_CHANGES = 2;

/**
 * Ce qui a changé entre le début et la fin d'un tour (specs/meteo.md §5.3),
 * du plus marquant au moins marquant : la précipitation, le vent, le
 * brouillard, la température, le ciel.
 */
export function weatherChanges(before: Weather, after: Weather): WeatherChange[] {
  const changes: WeatherChange[] = [];
  if (before.precipitation !== after.precipitation) {
    if (before.precipitation === "none") changes.push({ kind: "precipitation_starts", precipitation: after.precipitation });
    else if (after.precipitation === "none") changes.push({ kind: "precipitation_stops", precipitation: before.precipitation });
    else changes.push({ kind: "precipitation_changes", from: before.precipitation, to: after.precipitation });
  }
  const windDelta = WINDS.indexOf(after.wind) - WINDS.indexOf(before.wind);
  if (windDelta > 0) changes.push({ kind: "wind_rises", wind: after.wind });
  if (windDelta < 0) changes.push({ kind: "wind_drops", wind: after.wind });
  if (!before.fog && after.fog) changes.push({ kind: "fog_forms" });
  if (before.fog && !after.fog) changes.push({ kind: "fog_lifts" });
  const delta = after.temperatureC - before.temperatureC;
  if (delta <= -NOTABLE_DELTA_C) changes.push({ kind: "colder", temperatureC: after.temperatureC });
  if (delta >= NOTABLE_DELTA_C) changes.push({ kind: "warmer", temperatureC: after.temperatureC });
  if (before.sky !== after.sky) changes.push({ kind: "sky_changes", sky: after.sky });
  return changes.slice(0, MAX_CHANGES);
}
