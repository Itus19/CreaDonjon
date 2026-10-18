import { describe, expect, it } from "vitest";
import { DEFAULT_CALENDAR } from "./defaultCalendar";
import type { CalendarConfig } from "./types";
import { clampDayToCalendar, daysBetween, dayOfYearNumber, eraBand, monthGrid, shiftDate, yearInEra } from "./navigation";

/**
 * V3.1-55 — le calendrier ingame, « l'année d'un coup d'œil ». Tous les
 * calculs de l'écran vivent ici ; le composant n'en fait aucun.
 */

const CAL: CalendarConfig = { ...DEFAULT_CALENDAR, eras: [{ name: "Âge des Couronnes", startYear: 1000 }, { name: "Âge des Cendres", startYear: 1400 }] };
/** Deux mois inégaux, pour les débordements. */
const COURT: CalendarConfig = { ...DEFAULT_CALENDAR, months: [{ name: "Un", days: 5 }, { name: "Deux", days: 7 }, { name: "Trois", days: 3 }] };

describe("shiftDate", () => {
  it("le lendemain du dernier jour de l'an est le 1er jour du 1er mois de l'an suivant", () => {
    expect(shiftDate({ year: 1492, month: 12, day: 30 }, 1, CAL)).toEqual({ year: 1493, month: 1, day: 1 });
  });
  it("la veille du 1er jour de l'an 0 est le dernier jour de l'an −1", () => {
    expect(shiftDate({ year: 0, month: 1, day: 1 }, -1, CAL)).toEqual({ year: -1, month: 12, day: 30 });
  });
  it("un décalage de 10 jours franchit deux mois", () => {
    // Un (5) : du 4 Un, +10 → 5 Un (+1), puis Deux 1..7 (+8), puis 1 Trois (+9), 2 Trois (+10).
    expect(shiftDate({ year: 3, month: 1, day: 4 }, 10, COURT)).toEqual({ year: 3, month: 3, day: 2 });
  });
});

describe("dayOfYearNumber", () => {
  it("compte à partir de 1 : le 14 Brumaire est le jour 44 sur 360", () => {
    expect(dayOfYearNumber({ year: 1492, month: 2, day: 14 }, CAL)).toBe(44);
  });
});

describe("clampDayToCalendar", () => {
  it("raccourcir un mois recale le jour sur son dernier jour : le 14 d'un mois de 10 jours devient le 10", () => {
    const raccourci: CalendarConfig = { ...CAL, months: CAL.months.map((m, i) => (i === 1 ? { ...m, days: 10 } : m)) };
    expect(clampDayToCalendar({ year: 1492, month: 2, day: 14 }, raccourci)).toEqual({ year: 1492, month: 2, day: 10 });
  });
  it("un mois supprimé ramène au dernier mois restant", () => {
    expect(clampDayToCalendar({ year: 1, month: 5, day: 2 }, COURT)).toEqual({ year: 1, month: 3, day: 2 });
  });
  it("une date valide ne bouge pas", () => {
    expect(clampDayToCalendar({ year: 1, month: 2, day: 7 }, COURT)).toEqual({ year: 1, month: 2, day: 7 });
  });
});

describe("yearInEra", () => {
  it("l'ère qui couvre l'année, et le rang de l'année dans l'ère (l'année de départ est l'an 1)", () => {
    expect(yearInEra(1492, CAL)).toEqual({ name: "Âge des Cendres", year: 93 });
    expect(yearInEra(1000, CAL)).toEqual({ name: "Âge des Couronnes", year: 1 });
  });
  it("aucune ère avant la première", () => {
    expect(yearInEra(500, CAL)).toBeNull();
  });
});

describe("eraBand", () => {
  it("chaque ère a une largeur proportionnelle à sa durée ; la dernière court jusqu'à an actuel + 300", () => {
    const band = eraBand(CAL, 1492);
    // Couronnes : 1000 → 1400 (400 ans) ; Cendres : 1400 → 1792 (392 ans) ; total 792.
    expect(band.segments.map((s) => s.name)).toEqual(["Âge des Couronnes", "Âge des Cendres"]);
    expect(band.segments[0].fraction).toBeCloseTo(400 / 792);
    expect(band.segments[1].fraction).toBeCloseTo(392 / 792);
    expect(band.current).toBeCloseTo(492 / 792);
  });
  it("les ères sont triées par année de départ, quel que soit l'ordre saisi", () => {
    const desordre: CalendarConfig = { ...CAL, eras: [...CAL.eras].reverse() };
    expect(eraBand(desordre, 1492).segments.map((s) => s.name)).toEqual(["Âge des Couronnes", "Âge des Cendres"]);
  });
  it("sans ère, une frise vide", () => {
    expect(eraBand(DEFAULT_CALENDAR, 10)).toEqual({ segments: [], current: null });
  });
});

describe("monthGrid", () => {
  it("place le 1er jour du mois sous son jour de semaine, et compte les jours du mois", () => {
    // 1er Vendémiaire an 0 = Primidi (indice 0) ; le 1er Brumaire an 0 est 30 jours plus tard : 30 % 10 = 0, Primidi.
    const grille = monthGrid(0, 2, CAL);
    expect(grille.offset).toBe(0);
    expect(grille.days).toBe(30);
    expect(grille.weekLength).toBe(10);
  });
  it("décaler le 1er jour de l'an 0 décale toutes les grilles", () => {
    expect(monthGrid(0, 2, { ...CAL, weekdayEpoch: 3 }).offset).toBe(3);
    expect(monthGrid(1492, 7, { ...CAL, weekdayEpoch: 3 }).offset).toBe((monthGrid(1492, 7, CAL).offset + 3) % 10);
  });
  it("sans jours de semaine, aucune colonne", () => {
    expect(monthGrid(0, 1, { ...CAL, weekdays: [] })).toEqual({ offset: 0, days: 30, weekLength: 0 });
  });
});

describe("daysBetween", () => {
  it("compte les jours de l'une à l'autre (« dans 6 jours »), négatif vers le passé", () => {
    expect(daysBetween({ year: 1492, month: 2, day: 24 }, { year: 1492, month: 2, day: 30 }, CAL)).toBe(6);
    expect(daysBetween({ year: 1492, month: 1, day: 1 }, { year: 1491, month: 12, day: 30 }, CAL)).toBe(-1);
  });
});
