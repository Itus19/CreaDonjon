import type { CalendarConfig, GameDate } from "./types";

/** Nombre total de jours d'une annee de ce calendrier — exporte pour `axisPosition.ts` (position continue sur l'axe horizontal de la chronologie). */
export function yearLength(calendar: CalendarConfig): number {
  return calendar.months.reduce((sum, m) => sum + m.days, 0);
}

/** Somme des jours des mois strictement avant `month` (1-indexe). */
function daysBeforeMonth(calendar: CalendarConfig, month: number): number {
  let sum = 0;
  for (let i = 0; i < month - 1 && i < calendar.months.length; i++) {
    sum += calendar.months[i].days;
  }
  return sum;
}

/**
 * Entier de tri stocke a cote de chaque date (specs/wiki-blocs.md §3) : le
 * tri, les filtres de periode et les regroupements fonctionnent sans que le
 * code de la frise connaisse quoi que ce soit au calendrier — un calendrier
 * a treize mois de vingt-huit jours ne casse rien. Un mois/jour absent
 * (precision plus large que "day"/"month") compte comme le debut de la
 * periode : le premier jour du premier mois de l'annee.
 */
export function computeSortKey(
  date: Pick<GameDate, "year" | "month" | "day">,
  calendar: CalendarConfig
): number {
  const length = yearLength(calendar);
  const month = date.month ?? 1;
  const day = date.day ?? 1;
  return date.year * length + daysBeforeMonth(calendar, month) + (day - 1);
}
