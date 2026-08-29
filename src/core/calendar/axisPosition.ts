import { computeSortKey, yearLength } from "./sortKey";
import type { CalendarConfig, GameDate } from "./types";

/**
 * Position continue en "annees" d'une date sur l'axe horizontal de la
 * chronologie (V2-H2, reprise visuelle du bloc `timeline` sur references
 * fournies par l'utilisateur) — `sort_key` (entier, jours depuis une
 * origine) divise par la longueur d'annee du calendrier. Une fraction
 * d'annee, pas un troisieme systeme de dates : purement une projection de
 * `computeSortKey` pour le zoom/pan de l'axe.
 */
export function yearPosition(date: Pick<GameDate, "year" | "month" | "day">, calendar: CalendarConfig): number {
  return computeSortKey(date, calendar) / yearLength(calendar);
}

/** Inverse de `yearPosition` — la date (precision "jour") exacte a cette position. Utilisee pour placer une nouvelle entree au point clique sur l'axe. */
export function dateAtYearPosition(position: number, calendar: CalendarConfig): GameDate {
  const year = Math.floor(position);
  const length = yearLength(calendar);
  const dayOfYear = Math.round((position - year) * length);

  let remaining = Math.max(0, Math.min(dayOfYear, length - 1));
  let month = 1;
  for (const m of calendar.months) {
    if (remaining < m.days) break;
    remaining -= m.days;
    month++;
  }

  return { year, month, day: remaining + 1, precision: "day", end: null, label: null };
}
