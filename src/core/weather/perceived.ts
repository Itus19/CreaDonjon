import { normaliserNomPiece } from "../rules/rooms";
import type { RoomExposure, RoomsBlockData } from "../schemas/blocks/rooms";
import type { Weather } from "./weather";

/**
 * Dedans ou dehors (specs/meteo.md §6, ME-4). Le temps qu'il fait est le
 * même partout dans un lieu ; ce que le personnage en PERÇOIT dépend de
 * l'endroit où il se tient. C'est ce qui empêche la pluie de tomber dans la
 * taverne.
 */

export type Exposure = RoomExposure;

/**
 * L'exposition de l'endroit où se tient le personnage :
 * 1. la pièce du wiki où il est, si elle en a une ;
 * 2. une pièce sans exposition, ou une esquisse de pièce : dedans ;
 * 3. hors de toute pièce, l'exposition de l'espace principal si elle est écrite ;
 * 4. sinon dedans pour un bâtiment (le lieu a des pièces, ou une carte des
 *    prix), dehors pour le reste (une rue, une clairière).
 */
export function exposureHere(params: { roomBlocks: readonly RoomsBlockData[]; roomName: string | null; buildingHint: boolean }): Exposure {
  const { roomBlocks, roomName, buildingHint } = params;
  if (roomName !== null) {
    const cle = normaliserNomPiece(roomName);
    const piece = roomBlocks.flatMap((b) => b.rooms).find((r) => normaliserNomPiece(r.name) === cle);
    return piece?.exposure ?? "indoor";
  }
  const principal = roomBlocks.find((b) => b.main_exposure !== undefined)?.main_exposure;
  if (principal) return principal;
  return roomBlocks.some((b) => b.rooms.length > 0) || buildingHint ? "indoor" : "outdoor";
}

export type WeatherCue =
  /** Dedans : ce qui s'entend ou se sent à travers les murs. */
  | "rain_on_roof"
  | "hail_on_roof"
  | "thunder"
  | "snow_light"
  | "sleet_on_windows"
  | "wind_howls"
  | "wind_whistles"
  | "fog_at_windows"
  | "cold_seeps"
  | "stifling_heat"
  /** À l'abri : la précipitation tombe à côté, le vent atteint le personnage. */
  | "precipitation_nearby"
  | "wind_felt";

/**
 * Ce que le personnage perçoit du temps, en plus de ce qu'il voit
 * directement. Dehors : rien de plus, il y est. À l'abri : la pluie à côté
 * et le vent. Dedans : seulement ce qui traverse les murs, et jamais une
 * précipitation sur lui.
 */
export function perceivedCues(weather: Weather, exposure: Exposure): WeatherCue[] {
  if (exposure === "outdoor") return [];
  const cues: WeatherCue[] = [];
  if (exposure === "sheltered") {
    if (weather.precipitation !== "none") cues.push("precipitation_nearby");
    if (weather.wind === "wind" || weather.wind === "gale") cues.push("wind_felt");
    return cues;
  }
  switch (weather.precipitation) {
    case "rain":
    case "downpour":
      cues.push("rain_on_roof");
      break;
    case "thunderstorm":
      cues.push("thunder");
      break;
    case "hail":
      cues.push("hail_on_roof");
      break;
    case "snow":
      cues.push("snow_light");
      break;
    case "sleet":
      cues.push("sleet_on_windows");
      break;
    default:
      break;
  }
  if (weather.wind === "gale") cues.push("wind_howls");
  else if (weather.wind === "wind") cues.push("wind_whistles");
  if (weather.fog) cues.push("fog_at_windows");
  if (weather.feel === "freezing") cues.push("cold_seeps");
  if (weather.feel === "scorching") cues.push("stifling_heat");
  return cues;
}
