import type { CalendarConfig } from "./types";

/**
 * Jour de la semaine d'une date (retour utilisateur, V2.1-3 suite) : calculé
 * plutôt que saisi, à partir d'un seul point de référence réglable
 * (`calendar.weekdayEpoch`, "quel jour de semaine tombe le 1er jour de l'an
 * 0") — jamais figé sur "le 1er Vendémiaire an 0 est un Primidi" en dur,
 * un monde qui renomme ses jours de semaine peut vouloir un décalage
 * différent.
 *
 * Modulo qui reste positif pour une année négative (`((n % m) + m) % m`,
 * jamais le `%` natif de JS qui peut renvoyer un résultat négatif) : une
 * date avant l'an 0 doit quand même retomber sur un jour de semaine valide.
 */
function properMod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

/** Décalage (0-indexé) du 1er jour du mois `month` (1-indexé) dans son année — `month` au-delà des mois définis dégrade proprement plutôt que de planter (calendrier édité après coup, meme motif que le reste de ce module). */
function dayOfYear(month: number, day: number, calendar: CalendarConfig): number {
  const daysBefore = calendar.months.slice(0, month - 1).reduce((sum, m) => sum + m.days, 0);
  return daysBefore + (day - 1);
}

/**
 * Indice (dans `calendar.weekdays`) du jour de semaine d'une date complète —
 * `null` si le calendrier n'a aucun jour de semaine défini, ou si la date
 * n'a pas de mois/jour (précision plus large que "jour" : "l'an 1247" n'a
 * pas de jour de semaine).
 */
export function weekdayIndexForDate(date: { year: number; month: number | null; day: number | null }, calendar: CalendarConfig): number | null {
  if (calendar.weekdays.length === 0 || date.month === null || date.day === null) return null;
  const daysPerYear = calendar.months.reduce((sum, m) => sum + m.days, 0);
  if (daysPerYear === 0) return null;
  const totalDays = date.year * daysPerYear + dayOfYear(date.month, date.day, calendar);
  return properMod(totalDays + calendar.weekdayEpoch, calendar.weekdays.length);
}

/** Nom du jour de semaine d'une date — `null` dans les mêmes cas que `weekdayIndexForDate`. */
export function weekdayNameForDate(date: { year: number; month: number | null; day: number | null }, calendar: CalendarConfig): string | null {
  const index = weekdayIndexForDate(date, calendar);
  return index === null ? null : (calendar.weekdays[index]?.name ?? null);
}
