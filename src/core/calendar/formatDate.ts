import type { CalendarConfig, DatePrecision, GameDate } from "./types";

function monthName(calendar: CalendarConfig, month: number): string {
  return calendar.months[month - 1]?.name ?? `mois ${month}`;
}

/** La derniere ere dont `startYear` ne depasse pas `year` — `null` si aucune ere ne la couvre encore. */
function eraNameFor(calendar: CalendarConfig, year: number): string | null {
  let found: string | null = null;
  let latestStart = -Infinity;
  for (const era of calendar.eras) {
    if (era.startYear <= year && era.startYear > latestStart) {
      found = era.name;
      latestStart = era.startYear;
    }
  }
  return found;
}

function formatByPrecision(
  parts: { year: number; month: number | null; day: number | null },
  precision: DatePrecision,
  calendar: CalendarConfig
): string {
  switch (precision) {
    case "day":
      return parts.month !== null && parts.day !== null
        ? `${parts.day} ${monthName(calendar, parts.month)} ${parts.year}`
        : String(parts.year);
    case "month":
      return parts.month !== null ? `${monthName(calendar, parts.month)} ${parts.year}` : String(parts.year);
    case "season":
      // Aucun vocabulaire de saison dans le calendrier (non demande par le
      // ticket) : repli sur l'annee, comme "year" — `label` couvre deja ce
      // besoin ("a l'automne 1200"). A construire si un cas concret l'exige.
      return String(parts.year);
    case "year":
      return String(parts.year);
    case "decade":
      return `années ${Math.floor(parts.year / 10) * 10}`;
    case "era":
      return eraNameFor(calendar, parts.year) ?? String(parts.year);
  }
}

/**
 * Formate une date de jeu pour l'affichage (specs/wiki-blocs.md §3) :
 * `label` prime toujours quand renseigne ("le Troisieme Hiver Noir" plutot
 * qu'une date) ; sinon la date est composee selon `precision` et le
 * calendrier du monde ; `end` ajoute une periode ("1200 – 1204").
 */
export function formatGameDate(date: GameDate, calendar: CalendarConfig): string {
  if (date.label) return date.label;
  const start = formatByPrecision(date, date.precision, calendar);
  if (!date.end) return start;
  const end = formatByPrecision(date.end, date.precision, calendar);
  return `${start} – ${end}`;
}
