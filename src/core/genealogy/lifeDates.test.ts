import { describe, expect, it } from "vitest";
import { lifeDatesFromCharacter, ageWithDeath } from "./lifeDates";
import type { GameDate } from "../calendar/types";

function date(year: number, month: number | null = null, day: number | null = null): GameDate {
  return { year, month, day, precision: day !== null ? "day" : month !== null ? "month" : "year", end: null, label: null };
}

describe("dates de vie lues dans le bloc character (V3.1-74)", () => {
  it("naissance et mort", () => {
    expect(lifeDatesFromCharacter({ birth: date(1420), death: date(1478) })).toEqual({ birth: date(1420), death: date(1478) });
  });

  it("une fiche sans date n'en invente aucune", () => {
    expect(lifeDatesFromCharacter({ age: 40 })).toEqual({});
    expect(lifeDatesFromCharacter(undefined)).toEqual({});
  });

  it("une date mal formée est ignorée, l'autre reste", () => {
    expect(lifeDatesFromCharacter({ birth: { year: "x" }, death: date(1478) })).toEqual({ death: date(1478) });
  });
});

describe("l'âge s'arrête à la mort (V3.1-74)", () => {
  const today = date(1500, 1, 1);
  it("vivant : âge à la date du jour", () => {
    expect(ageWithDeath(date(1420, 3, 1), today, undefined)).toBe(79);
  });
  it("défunt : âge au jour de la mort, quelle que soit la date du jour", () => {
    expect(ageWithDeath(date(1420, 3, 1), today, date(1478, 6, 1))).toBe(58);
  });
  it("sans naissance, ou sans date du jour pour un vivant : pas d'âge", () => {
    expect(ageWithDeath(undefined, today, date(1478))).toBeUndefined();
    expect(ageWithDeath(date(1420), null, undefined)).toBeUndefined();
  });
  it("défunt sans date du jour réglée : l'âge se calcule quand même", () => {
    expect(ageWithDeath(date(1420), null, date(1478))).toBe(58);
  });
});
