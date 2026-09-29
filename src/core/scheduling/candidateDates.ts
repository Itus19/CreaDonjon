/**
 * Résolution d'un motif "jours de semaine sur une fenêtre" en dates
 * concrètes (V3.1-8, assistant MJ — deuxième onglet, à côté de la
 * sélection au clic sur des dates précises). Une fois résolu, une demande
 * ne connaît plus que des dates concrètes (`availability_requests.candidate_dates`)
 * — jamais besoin de réévaluer le motif plus tard.
 *
 * Convention lundi=0…dimanche=6, même choix que `AvailabilityCalendar.tsx`
 * (`(firstOfMonth.getDay() + 6) % 7`), pas la convention `Date.getDay()`
 * native (dimanche=0).
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toUtcDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00Z`);
}

function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function mondayFirstWeekday(date: Date): number {
  return (date.getUTCDay() + 6) % 7;
}

export function expandWeekdayPattern(weekdays: readonly number[], fromDate: string, toDate: string): string[] {
  const wanted = new Set(weekdays);
  const from = toUtcDate(fromDate);
  const to = toUtcDate(toDate);
  const dates: string[] = [];
  for (let t = from.getTime(); t <= to.getTime(); t += MS_PER_DAY) {
    const current = new Date(t);
    if (wanted.has(mondayFirstWeekday(current))) dates.push(toDateStr(current));
  }
  return dates;
}
