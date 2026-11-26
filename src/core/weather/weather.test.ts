import { describe, expect, it } from "vitest";
import { climateOf, DEFAULT_WORLD_CLIMATE, type Climate } from "./climate";
import { yearPhase } from "./season";
import { weatherAt, weatherChanges, type Weather } from "./weather";

const tempere: Climate = climateOf({ biome: "temperate_deciduous_forest", climate: { latitude: 45 } }, DEFAULT_WORLD_CLIMATE);
const desert: Climate = climateOf({ biome: "hot_desert", climate: { latitude: 25 } }, DEFAULT_WORLD_CLIMATE);
const pluvieux: Climate = climateOf({ biome: "temperate_rainforest", climate: { latitude: 48, coastal: true } }, DEFAULT_WORLD_CLIMATE);
const sud: Climate = { ...tempere, latitude: -45 };

/** Toutes les heures d'une année de 360 jours, le cœur de l'hiver (au nord) au jour 1. */
function annee(climate: Climate, seed: number): Weather[] {
  const out: Weather[] = [];
  for (let day = 1; day <= 360; day++) {
    for (let hour = 0; hour < 24; hour += 1) {
      out.push(weatherAt({ climate, phase: yearPhase({ dayOfYear: day, yearLength: 360, latitude: climate.latitude }), absoluteDay: day, hour, seed }));
    }
  }
  return out;
}

function moyenne(ws: Weather[]): number {
  return ws.reduce((s, w) => s + w.temperatureC, 0) / ws.length;
}

function partPluie(ws: Weather[]): number {
  return ws.filter((w) => w.precipitation !== "none").length / ws.length;
}

describe("weatherAt", () => {
  it("rend le même temps pour le même lieu, le même jour et la même heure", () => {
    const a = weatherAt({ climate: tempere, phase: 0.3, absoluteDay: 112, hour: 14, seed: 42 });
    const b = weatherAt({ climate: tempere, phase: 0.3, absoluteDay: 112, hour: 14, seed: 42 });
    expect(a).toEqual(b);
  });

  it("donne des temps différents à deux graines différentes", () => {
    const a = annee(tempere, 1).map((w) => w.precipitation);
    const b = annee(tempere, 2).map((w) => w.precipitation);
    expect(a).not.toEqual(b);
  });

  it("fait l'hiver plus froid que l'été au nord", () => {
    const ws = annee(tempere, 7);
    const hiver = ws.slice(0, 30 * 24);
    const ete = ws.slice(165 * 24, 195 * 24);
    expect(moyenne(ete) - moyenne(hiver)).toBeGreaterThan(10);
  });

  it("inverse les saisons dans l'hémisphère sud", () => {
    const ws = annee(sud, 7);
    const janvier = ws.slice(0, 30 * 24);
    const juillet = ws.slice(165 * 24, 195 * 24);
    expect(moyenne(janvier)).toBeGreaterThan(moyenne(juillet));
  });

  it("garde une moyenne annuelle proche de la normale du climat", () => {
    expect(Math.abs(moyenne(annee(tempere, 3)) - tempere.meanTempC)).toBeLessThan(2);
  });

  it("fait l'après-midi plus chaud que l'aube", () => {
    const ws = annee(tempere, 11);
    const aube = ws.filter((_, i) => i % 24 === 4);
    const aprem = ws.filter((_, i) => i % 24 === 15);
    expect(moyenne(aprem)).toBeGreaterThan(moyenne(aube) + 3);
  });

  it("ne fait presque jamais pleuvoir au désert, souvent en forêt pluvieuse", () => {
    expect(partPluie(annee(desert, 5))).toBeLessThan(0.03);
    expect(partPluie(annee(pluvieux, 5))).toBeGreaterThan(0.15);
  });

  it("ne fait neiger ou tomber du grésil que sous 2 °C", () => {
    for (const w of [...annee(tempere, 9), ...annee(climateOf(null, { biome: "taiga", latitude: 60 }), 9)]) {
      if (w.precipitation === "snow" || w.precipitation === "sleet") expect(w.temperatureC).toBeLessThan(2);
      if (w.precipitation === "rain" || w.precipitation === "downpour" || w.precipitation === "thunderstorm") expect(w.temperatureC).toBeGreaterThanOrEqual(0);
    }
  });

  it("finit par faire neiger en hiver dans la taïga", () => {
    const ws = annee(climateOf(null, { biome: "taiga", latitude: 60 }), 4);
    expect(ws.some((w) => w.precipitation === "snow")).toBe(true);
  });

  it("change la température par petites touches d'une heure à l'autre", () => {
    const ws = annee(tempere, 13);
    for (let i = 1; i < ws.length; i++) {
      expect(Math.abs(ws[i].temperatureC - ws[i - 1].temperatureC)).toBeLessThanOrEqual(4);
    }
  });

  it("fait durer un épisode de pluie plus d'une heure en moyenne", () => {
    const ws = annee(pluvieux, 21);
    let episodes = 0;
    let heures = 0;
    for (let i = 0; i < ws.length; i++) {
      const pleut = ws[i].precipitation !== "none";
      if (pleut) heures++;
      if (pleut && (i === 0 || ws[i - 1].precipitation === "none")) episodes++;
    }
    expect(heures / episodes).toBeGreaterThan(2);
  });

  it("ne donne aucune saison sans date réglée", () => {
    const w = weatherAt({ climate: tempere, phase: null, absoluteDay: 10, hour: 12, seed: 1 });
    expect(w.season).toBeNull();
  });

  it("nomme la saison selon la position dans l'année", () => {
    expect(weatherAt({ climate: tempere, phase: 0.5, absoluteDay: 180, hour: 12, seed: 1 }).season).toBe("summer");
  });

  it("accorde la sensation à la température", () => {
    for (const w of annee(tempere, 17)) {
      if (w.temperatureC <= -5) expect(w.feel).toBe("freezing");
      if (w.temperatureC > 35) expect(w.feel).toBe("scorching");
    }
  });

  it("ne pose le brouillard que le matin et par vent calme ou faible", () => {
    for (const w of annee(pluvieux, 23).map((w, i) => ({ w, hour: i % 24 }))) {
      if (w.w.fog) {
        expect(w.hour).toBeGreaterThanOrEqual(3);
        expect(w.hour).toBeLessThanOrEqual(10);
        expect(["calm", "breeze"]).toContain(w.w.wind);
      }
    }
  });

  it("refuse une heure hors de la journée", () => {
    expect(() => weatherAt({ climate: tempere, phase: 0, absoluteDay: 1, hour: 24, seed: 1 })).toThrow(RangeError);
  });
});

const base: Weather = { sky: "cloudy", precipitation: "none", wind: "breeze", fog: false, temperatureC: 10, feel: "cool", season: "spring" };

describe("weatherChanges", () => {
  it("ne dit rien quand rien ne change", () => {
    expect(weatherChanges(base, base)).toEqual([]);
  });

  it("dit que la pluie commence et qu'elle cesse", () => {
    expect(weatherChanges(base, { ...base, precipitation: "rain" })).toEqual([{ kind: "precipitation_starts", precipitation: "rain" }]);
    expect(weatherChanges({ ...base, precipitation: "rain" }, base)).toEqual([{ kind: "precipitation_stops", precipitation: "rain" }]);
  });

  it("dit que la pluie change de nature", () => {
    expect(weatherChanges({ ...base, precipitation: "drizzle" }, { ...base, precipitation: "downpour" })).toEqual([
      { kind: "precipitation_changes", from: "drizzle", to: "downpour" },
    ]);
  });

  it("dit que le vent se lève ou tombe", () => {
    expect(weatherChanges(base, { ...base, wind: "gale" })).toEqual([{ kind: "wind_rises", wind: "gale" }]);
    expect(weatherChanges({ ...base, wind: "wind" }, { ...base, wind: "calm" })).toEqual([{ kind: "wind_drops", wind: "calm" }]);
  });

  it("signale un écart de cinq degrés ou plus, pas moins", () => {
    expect(weatherChanges(base, { ...base, temperatureC: 14 })).toEqual([]);
    expect(weatherChanges(base, { ...base, temperatureC: 4 })).toEqual([{ kind: "colder", temperatureC: 4 }]);
  });

  it("garde les deux changements les plus marquants, la précipitation d'abord", () => {
    const after: Weather = { ...base, precipitation: "rain", wind: "gale", fog: true, temperatureC: 2, sky: "overcast" };
    const changes = weatherChanges(base, after);
    expect(changes).toHaveLength(2);
    expect(changes[0].kind).toBe("precipitation_starts");
    expect(changes[1].kind).toBe("wind_rises");
  });
});
