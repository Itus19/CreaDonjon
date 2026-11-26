import { describe, expect, it } from "vitest";
import { DEFAULT_CALENDAR } from "../calendar/defaultCalendar";
import type { CalendarConfig } from "../calendar/types";
import { climateOf, DEFAULT_WORLD_CLIMATE } from "./climate";
import { scenePhase, weatherForScene, type WeatherContext } from "./sceneWeather";

const dated: CalendarConfig = {
  ...DEFAULT_CALENDAR,
  coldestMonth: undefined,
  currentDate: { year: 1200, month: 1, day: 16, precision: "day", end: null, label: null },
};
const ctx: WeatherContext = {
  climate: climateOf(null, DEFAULT_WORLD_CLIMATE),
  seed: 1234,
  calendar: dated,
  roomBlocks: [{ __v: 1, rooms: [{ id: "cour", name: "La cour", description: "", exposure: "outdoor" }] }],
  buildingHint: false,
};

describe("scenePhase", () => {
  it("met le cœur de l'hiver au milieu du premier mois quand rien n'est réglé", () => {
    expect(scenePhase(1, dated, 45)).toBeCloseTo(0, 5);
  });

  it("suit le mois le plus froid réglé dans le calendrier", () => {
    // Le républicain par défaut : Nivôse (4e mois) ; le 16 Vendémiaire tombe trois mois avant, en automne.
    const phase = scenePhase(1, { ...dated, coldestMonth: 4 }, 45);
    expect(phase).toBeCloseTo(270 / 360, 5);
  });

  it("rend null sans date réglée au jour", () => {
    expect(scenePhase(1, { ...dated, currentDate: null }, 45)).toBeNull();
  });
});

describe("weatherForScene", () => {
  it("met dedans l'espace principal d'un lieu qui a des pièces, dehors sa cour", () => {
    expect(weatherForScene(ctx, { day: 3, hour: 10, minute: 0 }, null).exposure).toBe("indoor");
    expect(weatherForScene(ctx, { day: 3, hour: 10, minute: 0 }, "La cour").exposure).toBe("outdoor");
  });

  it("rend le même temps quelle que soit la pièce : seul le perçu change", () => {
    const dedans = weatherForScene(ctx, { day: 3, hour: 10, minute: 0 }, null);
    const dehors = weatherForScene(ctx, { day: 3, hour: 10, minute: 0 }, "La cour");
    expect(dedans.weather).toEqual(dehors.weather);
    expect(dehors.cues).toEqual([]);
  });

  it("nomme la saison quand le calendrier est réglé", () => {
    expect(weatherForScene(ctx, { day: 1, hour: 12, minute: 0 }, null).weather.season).toBe("winter");
  });
});
