import { describe, expect, it } from "vitest";
import { computeSortKey } from "./sortKey";
import { DEFAULT_CALENDAR } from "./defaultCalendar";
import type { CalendarConfig } from "./types";

/** Ticket V2-H2, critere explicite : "Le tri et le filtrage fonctionnent avec un calendrier a treize mois de vingt-huit jours." */
const THIRTEEN_MONTHS: CalendarConfig = {
  months: Array.from({ length: 13 }, (_, i) => ({ name: `Mois ${i + 1}`, days: 28 })),
  daysPerWeek: 7,
  eras: [],
};

describe("computeSortKey", () => {
  it("trie deux dates de la meme annee par mois puis par jour", () => {
    const a = computeSortKey({ year: 1247, month: 3, day: 1 }, DEFAULT_CALENDAR);
    const b = computeSortKey({ year: 1247, month: 3, day: 12 }, DEFAULT_CALENDAR);
    const c = computeSortKey({ year: 1247, month: 4, day: 1 }, DEFAULT_CALENDAR);
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
  });

  it("un mois/jour absent (precision plus large) compte comme le debut de la periode", () => {
    const yearOnly = computeSortKey({ year: 1200, month: null, day: null }, DEFAULT_CALENDAR);
    const midYear = computeSortKey({ year: 1200, month: 6, day: 15 }, DEFAULT_CALENDAR);
    const nextYearOnly = computeSortKey({ year: 1201, month: null, day: null }, DEFAULT_CALENDAR);
    expect(yearOnly).toBeLessThan(midYear);
    expect(midYear).toBeLessThan(nextYearOnly);
  });

  it("fonctionne avec un calendrier a treize mois de vingt-huit jours, y compris au passage d'annee", () => {
    const lastDayOfYear1 = computeSortKey({ year: 1, month: 13, day: 28 }, THIRTEEN_MONTHS);
    const firstDayOfYear2 = computeSortKey({ year: 2, month: 1, day: 1 }, THIRTEEN_MONTHS);
    expect(lastDayOfYear1).toBeLessThan(firstDayOfYear2);
    // 13 * 28 = 364 jours par annee : le dernier jour de l'an 1 et le premier de l'an 2 sont consecutifs.
    expect(firstDayOfYear2 - lastDayOfYear1).toBe(1);
  });

  it("ordonne correctement des annees negatives (avant une origine)", () => {
    const before = computeSortKey({ year: -50, month: 1, day: 1 }, DEFAULT_CALENDAR);
    const after = computeSortKey({ year: 1, month: 1, day: 1 }, DEFAULT_CALENDAR);
    expect(before).toBeLessThan(after);
  });
});
