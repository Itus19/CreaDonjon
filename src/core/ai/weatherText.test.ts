import { describe, expect, it } from "vitest";
import { describeWeatherForAi, outsideWeatherLine } from "./weatherText";
import type { Weather } from "../weather/weather";

const pluie: Weather = { sky: "overcast", precipitation: "drizzle", wind: "breeze", fog: false, temperatureC: 8, feel: "cool", season: "autumn" };

describe("outsideWeatherLine", () => {
  it("met la précipitation d'abord et la saison à la fin", () => {
    expect(outsideWeatherLine(pluie)).toBe("bruine, ciel couvert, vent léger, 8 °C, automne");
  });

  it("omet la saison sans date réglée", () => {
    expect(outsideWeatherLine({ ...pluie, precipitation: "none", season: null })).toBe("ciel couvert, vent léger, 8 °C");
  });
});

describe("describeWeatherForAi", () => {
  it("dit dehors le temps tel quel", () => {
    expect(describeWeatherForAi({ weather: pluie, exposure: "outdoor", cues: [] })).toBe("Le personnage est dehors. Temps : bruine, ciel couvert, vent léger, 8 °C, automne.");
  });

  it("sépare dedans le temps dehors et le perçu, avec la consigne", () => {
    const text = describeWeatherForAi({ weather: { ...pluie, precipitation: "rain" }, exposure: "indoor", cues: ["rain_on_roof"] });
    expect(text).toContain("Le personnage est à l'intérieur. Dehors : pluie");
    expect(text).toContain("Perçu d'ici : la pluie qui tambourine sur le toit et les volets.");
    expect(text).toContain("rien ne tombe sur lui");
  });

  it("dit « rien de notable » quand rien ne traverse les murs", () => {
    expect(describeWeatherForAi({ weather: pluie, exposure: "indoor", cues: [] })).toContain("Perçu d'ici : rien de notable.");
  });

  it("ajoute ce qui a changé depuis le tour précédent", () => {
    const text = describeWeatherForAi({ weather: pluie, exposure: "outdoor", cues: [], changes: [{ kind: "precipitation_stops", precipitation: "rain" }] });
    expect(text).toContain("Depuis le tour précédent : la pluie cesse.");
  });
});
