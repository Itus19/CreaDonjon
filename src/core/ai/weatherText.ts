import type { Exposure, WeatherCue } from "../weather/perceived";
import type { Precipitation, Sky, Weather, WeatherChange, Wind } from "../weather/weather";
import { SEASON_LABELS_FR, type Season } from "../weather/season";

/**
 * ME-5 (specs/meteo.md §6.4) — la météo telle que le modèle la reçoit : un
 * fait du moteur, calculé, jamais encadré comme une donnée du wiki. Deux
 * parts bien séparées : le temps qu'il fait dehors, et ce que le
 * personnage en perçoit là où il est. La consigne dit de ne décrire que le
 * perçu tant qu'il ne sort pas.
 */

const SKY: Record<Sky, string> = { clear: "ciel dégagé", hazy: "ciel voilé", cloudy: "ciel nuageux", overcast: "ciel couvert" };
const PRECIPITATION: Record<Precipitation, string> = {
  none: "",
  drizzle: "bruine",
  rain: "pluie",
  downpour: "pluie battante",
  thunderstorm: "orage",
  snow: "neige",
  sleet: "grésil",
  hail: "grêle",
};
/** Avec l'article, pour les changements : « la pluie cesse ». */
const PRECIPITATION_LA: Record<Precipitation, string> = {
  none: "",
  drizzle: "la bruine",
  rain: "la pluie",
  downpour: "la pluie battante",
  thunderstorm: "l'orage",
  snow: "la neige",
  sleet: "le grésil",
  hail: "la grêle",
};
const WIND: Record<Wind, string> = { calm: "pas de vent", breeze: "vent léger", wind: "vent soutenu", gale: "vent de tempête" };
// Les mêmes mots que le bandeau (V3.2-59).
const SEASON: Record<Season, string> = SEASON_LABELS_FR;

const CUES: Record<WeatherCue, string> = {
  rain_on_roof: "la pluie qui tambourine sur le toit et les volets",
  hail_on_roof: "la grêle qui crépite sur le toit",
  thunder: "le tonnerre qui gronde, la pluie qui bat les murs",
  snow_light: "la lumière blanche et feutrée de la neige aux fenêtres",
  sleet_on_windows: "le grésil qui cingle les vitres",
  wind_howls: "le vent qui hurle et fait trembler les volets",
  wind_whistles: "le vent qui siffle sous la porte",
  fog_at_windows: "le brouillard collé aux fenêtres",
  cold_seeps: "un froid mordant qui passe les murs",
  stifling_heat: "une chaleur étouffante, même à l'ombre",
  precipitation_nearby: "la précipitation qui tombe juste à côté, sans l'atteindre",
  wind_felt: "le vent qui l'atteint",
};

const CHANGE = (c: WeatherChange): string => {
  switch (c.kind) {
    case "precipitation_starts":
      return c.precipitation === "thunderstorm" ? "l'orage éclate" : `${PRECIPITATION_LA[c.precipitation]} se met à tomber`;
    case "precipitation_stops":
      return `${PRECIPITATION_LA[c.precipitation]} cesse`;
    case "precipitation_changes":
      return `${PRECIPITATION_LA[c.from]} laisse place à ${PRECIPITATION_LA[c.to]}`;
    case "wind_rises":
      return `le vent se lève (${WIND[c.wind]})`;
    case "wind_drops":
      return `le vent tombe (${WIND[c.wind]})`;
    case "fog_forms":
      return "le brouillard se lève";
    case "fog_lifts":
      return "le brouillard se dissipe";
    case "colder":
      return `il fraîchit nettement (${c.temperatureC} °C)`;
    case "warmer":
      return `il se réchauffe nettement (${c.temperatureC} °C)`;
    case "sky_changes":
      return `le ciel change (${SKY[c.sky]})`;
  }
};

/** Le temps dehors, en une ligne : « pluie, ciel couvert, vent léger, 8 °C, automne ». */
export function outsideWeatherLine(weather: Weather): string {
  return [
    PRECIPITATION[weather.precipitation] || null,
    weather.fog ? "brouillard" : null,
    SKY[weather.sky],
    WIND[weather.wind],
    `${weather.temperatureC} °C`,
    weather.season ? SEASON[weather.season] : null,
  ]
    .filter((p): p is string => p !== null)
    .join(", ");
}

export function describeWeatherForAi(params: { weather: Weather; exposure: Exposure; cues: readonly WeatherCue[]; changes?: readonly WeatherChange[] }): string {
  const { weather, exposure, cues } = params;
  const dehors = outsideWeatherLine(weather);
  const lignes: string[] = [];
  if (exposure === "outdoor") {
    lignes.push(`Le personnage est dehors. Temps : ${dehors}.`);
  } else {
    const ou = exposure === "indoor" ? "à l'intérieur" : "à l'abri, mais à l'air libre";
    lignes.push(`Le personnage est ${ou}. Dehors : ${dehors}.`);
    lignes.push(`Perçu d'ici : ${cues.length > 0 ? cues.map((c) => CUES[c]).join(" ; ") : "rien de notable"}.`);
    lignes.push(
      exposure === "indoor"
        ? "Consigne : tant que le personnage ne sort pas, ne décris la météo qu'à travers ce perçu ; rien ne tombe sur lui, il n'est ni mouillé ni dans le vent."
        : "Consigne : il voit et entend la précipitation, sent le vent et la température, mais n'est pas sous la précipitation."
    );
  }
  if (params.changes && params.changes.length > 0) lignes.push(`Depuis le tour précédent : ${params.changes.map(CHANGE).join(" ; ")}.`);
  return lignes.join("\n");
}
