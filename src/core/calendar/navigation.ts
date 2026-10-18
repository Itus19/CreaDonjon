import type { CalendarConfig } from "./types";
import { computeSortKey, dateFromSortKey } from "./sortKey";
import { weekdayIndexForDate } from "./weekday";

/**
 * Le calendrier ingame, « l'année d'un coup d'œil » (V3.1-55) : tout ce que
 * l'écran calcule — décaler une date, la situer dans l'année et dans son ère,
 * dessiner la frise des ères et la grille d'un mois. Le composant n'en
 * calcule aucun. Une date complète, ici, a toujours un mois et un jour.
 */

export interface DayDate {
  year: number;
  month: number;
  day: number;
}

/** La date décalée de `n` jours (négatif vers le passé), années négatives comprises. */
export function shiftDate(date: DayDate, n: number, calendar: CalendarConfig): DayDate {
  return dateFromSortKey(computeSortKey(date, calendar) + n, calendar);
}

/** Les jours de `from` à `to` : « dans 6 jours » (positif), « il y a 2 jours » (négatif). */
export function daysBetween(from: DayDate, to: DayDate, calendar: CalendarConfig): number {
  return computeSortKey(to, calendar) - computeSortKey(from, calendar);
}

/** Le rang du jour dans son année, à partir de 1 (« jour 44 sur 360 »). */
export function dayOfYearNumber(date: DayDate, calendar: CalendarConfig): number {
  return computeSortKey({ year: 0, month: date.month, day: date.day }, calendar) + 1;
}

/**
 * Une date ramenée dans le calendrier tel qu'il est maintenant : un mois
 * supprimé ramène au dernier mois, un mois raccourci au dernier jour du mois
 * (« raccourcir Brumaire à 10 jours quand on est le 14 : on est le 10 »).
 */
export function clampDayToCalendar(date: DayDate, calendar: CalendarConfig): DayDate {
  if (calendar.months.length === 0) return { year: date.year, month: 1, day: 1 };
  const month = Math.min(Math.max(1, date.month), calendar.months.length);
  const days = calendar.months[month - 1].days;
  return { year: date.year, month, day: Math.min(Math.max(1, date.day), Math.max(1, days)) };
}

/** Les ères dans l'ordre chronologique (l'ordre saisi n'a pas de sens). */
function sortedEras(calendar: CalendarConfig) {
  return [...calendar.eras].sort((a, b) => a.startYear - b.startYear);
}

/** L'ère qui couvre l'année, et le rang de l'année dans l'ère (l'année de départ est l'an 1) ; `null` avant la première ère. */
export function yearInEra(year: number, calendar: CalendarConfig): { name: string; year: number } | null {
  const era = sortedEras(calendar)
    .filter((e) => e.startYear <= year)
    .at(-1);
  return era ? { name: era.name, year: year - era.startYear + 1 } : null;
}

/** Combien d'années la dernière ère court au-delà de l'an actuel, sur la frise. */
export const ERA_BAND_TAIL_YEARS = 300;

/**
 * La frise des ères : chaque ère a une largeur proportionnelle à sa durée (la
 * dernière court jusqu'à l'an actuel + 300), et `current` place l'an actuel
 * sur la bande (0 à 1, `null` sans ère ou avant la première).
 */
export function eraBand(
  calendar: CalendarConfig,
  currentYear: number
): { segments: { name: string; startYear: number; endYear: number; fraction: number }[]; current: number | null } {
  const eras = sortedEras(calendar);
  if (eras.length === 0) return { segments: [], current: null };
  const start = eras[0].startYear;
  const end = Math.max(currentYear, eras[eras.length - 1].startYear) + ERA_BAND_TAIL_YEARS;
  const total = end - start;
  const segments = eras.map((era, i) => {
    const endYear = i + 1 < eras.length ? eras[i + 1].startYear : end;
    return { name: era.name, startYear: era.startYear, endYear, fraction: total > 0 ? (endYear - era.startYear) / total : 0 };
  });
  const current = currentYear >= start && total > 0 ? (currentYear - start) / total : null;
  return { segments, current };
}

/**
 * La grille d'un mois : `offset` cases vides avant le 1er jour (son jour de
 * semaine), `days` jours, `weekLength` colonnes. Changer le jour de semaine
 * du 1er jour de l'an 0 (`weekdayEpoch`) décale toutes les grilles.
 */
export function monthGrid(year: number, month: number, calendar: CalendarConfig): { offset: number; days: number; weekLength: number } {
  const days = calendar.months[month - 1]?.days ?? 0;
  const weekLength = calendar.weekdays.length;
  const offset = weekdayIndexForDate({ year, month, day: 1 }, calendar) ?? 0;
  return { offset, days, weekLength };
}
