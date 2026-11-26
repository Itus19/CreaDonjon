import { yearLength } from "../calendar/sortKey";
import { dayOfYearNumber } from "../calendar/navigation";
import type { CalendarConfig } from "../calendar/types";
import { sceneCalendarDate, type GameTime } from "../rules/scene";
import type { RoomsBlockData } from "../schemas/blocks/rooms";
import type { Climate } from "./climate";
import { exposureHere, perceivedCues, type Exposure, type WeatherCue } from "./perceived";
import { yearPhase } from "./season";
import { weatherAt, type Weather } from "./weather";

/**
 * ME-5 — La météo d'une scène à une heure donnée : la colle entre l'horloge
 * de la scène, le calendrier du monde, le climat du lieu et ses pièces.
 * Pure : le serveur lit une fois ce qu'il faut (`loadWeatherContext`) et
 * peut recalculer à n'importe quelle heure sans relire.
 */
export interface WeatherContext {
  climate: Climate;
  seed: number;
  calendar: CalendarConfig;
  roomBlocks: RoomsBlockData[];
  /** Le lieu a une carte des prix : un bâtiment, même sans pièces décrites. */
  buildingHint: boolean;
}

export interface SceneWeather {
  weather: Weather;
  exposure: Exposure;
  cues: WeatherCue[];
}

/** Le cœur de l'hiver : le milieu du mois le plus froid (`coldestMonth`, le premier mois s'il n'est pas réglé). */
export function midwinterDayOf(calendar: CalendarConfig): number {
  const month = Math.min(Math.max(calendar.coldestMonth ?? 1, 1), calendar.months.length);
  const days = calendar.months[month - 1]?.days ?? 1;
  return dayOfYearNumber({ year: 0, month, day: Math.floor(days / 2) + 1 }, calendar);
}

/** La position dans l'année du jour de scène, `null` sans date « aujourd'hui » réglée au jour (§4.5). */
export function scenePhase(day: number, calendar: CalendarConfig, latitude: number): number | null {
  const date = sceneCalendarDate(day, calendar);
  const length = yearLength(calendar);
  if (date === null || date.month === null || date.day === null || length <= 0) return null;
  return yearPhase({
    dayOfYear: dayOfYearNumber({ year: date.year, month: date.month, day: date.day }, calendar),
    yearLength: length,
    latitude,
    midwinterDay: midwinterDayOf(calendar),
  });
}

export function weatherForScene(ctx: WeatherContext, time: GameTime, roomName: string | null): SceneWeather {
  const weather = weatherAt({
    climate: ctx.climate,
    phase: scenePhase(time.day, ctx.calendar, ctx.climate.latitude),
    absoluteDay: time.day,
    hour: time.hour,
    seed: ctx.seed,
  });
  const exposure = exposureHere({ roomBlocks: ctx.roomBlocks, roomName, buildingHint: ctx.buildingHint });
  return { weather, exposure, cues: perceivedCues(weather, exposure) };
}
