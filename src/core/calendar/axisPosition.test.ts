import { describe, expect, it } from "vitest";
import { yearPosition, dateAtYearPosition } from "./axisPosition";
import { DEFAULT_CALENDAR } from "./defaultCalendar";
import type { CalendarConfig } from "./types";

const THIRTEEN_MONTHS: CalendarConfig = {
  months: Array.from({ length: 13 }, (_, i) => ({ name: `Mois ${i + 1}`, days: 28 })),
  daysPerWeek: 7,
  eras: [],
};

describe("yearPosition", () => {
  it("un 1er janvier tombe exactement sur l'annee entiere", () => {
    expect(yearPosition({ year: 1200, month: 1, day: 1 }, DEFAULT_CALENDAR)).toBe(1200);
  });

  it("le milieu de l'annee tombe a peu pres a mi-chemin", () => {
    const pos = yearPosition({ year: 1200, month: 7, day: 1 }, DEFAULT_CALENDAR);
    expect(pos).toBeGreaterThan(1200.4);
    expect(pos).toBeLessThan(1200.6);
  });

  it("fonctionne avec un calendrier a treize mois de vingt-huit jours", () => {
    const pos = yearPosition({ year: 1, month: 13, day: 28 }, THIRTEEN_MONTHS);
    expect(pos).toBeGreaterThan(1.99);
    expect(pos).toBeLessThan(2);
  });
});

describe("dateAtYearPosition", () => {
  it("est l'inverse de yearPosition (aller-retour) pour une precision jour", () => {
    const original = { year: 1247, month: 3, day: 12 };
    const pos = yearPosition(original, DEFAULT_CALENDAR);
    const back = dateAtYearPosition(pos, DEFAULT_CALENDAR);
    expect(back.year).toBe(original.year);
    expect(back.month).toBe(original.month);
    expect(back.day).toBe(original.day);
  });

  it("une position entiere retombe sur le 1er jour du 1er mois", () => {
    const back = dateAtYearPosition(1200, DEFAULT_CALENDAR);
    expect(back).toMatchObject({ year: 1200, month: 1, day: 1 });
  });
});
