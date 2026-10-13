import { describe, expect, it } from "vitest";
import { DEFAULT_CALENDAR } from "./defaultCalendar";
import { ageAt, birthYearFromAge } from "./age";
import type { GameDate } from "./types";

function day(year: number, month: number | null, d: number | null): GameDate {
  return { year, month, day: d, precision: month === null ? "year" : "day", end: null, label: null };
}

// Mois dans l'ordre du calendrier par defaut : Germinal = 7, Messidor = 10.
const GERMINAL = DEFAULT_CALENDAR.months.findIndex((m) => m.name === "Germinal") + 1;
const MESSIDOR = DEFAULT_CALENDAR.months.findIndex((m) => m.name === "Messidor") + 1;

describe("ageAt", () => {
  it("anniversaire pas encore passe cette annee : un an de moins", () => {
    expect(ageAt(day(1370, MESSIDOR, 3), day(1492, GERMINAL, 14))).toBe(121);
  });

  it("anniversaire deja passe cette annee : difference d'annees", () => {
    expect(ageAt(day(1370, GERMINAL, 3), day(1492, MESSIDOR, 14))).toBe(122);
  });

  it("anniversaire le jour meme : l'annee est comptee", () => {
    expect(ageAt(day(1370, GERMINAL, 14), day(1492, GERMINAL, 14))).toBe(122);
  });

  it("la veille de l'anniversaire : pas encore", () => {
    expect(ageAt(day(1370, GERMINAL, 15), day(1492, GERMINAL, 14))).toBe(121);
  });

  it("naissance sans jour ni mois (precision annee) : difference d'annees", () => {
    expect(ageAt(day(1370, null, null), day(1492, GERMINAL, 14))).toBe(122);
  });

  it("naissance avec mois sans jour : le jour vaut le 1er", () => {
    expect(ageAt(day(1370, GERMINAL, null), day(1492, GERMINAL, 1))).toBe(122);
  });

  it("date du jour sans mois : difference d'annees", () => {
    expect(ageAt(day(1370, MESSIDOR, 3), day(1492, null, null))).toBe(122);
  });

  it("jamais negatif (naissance dans le futur)", () => {
    expect(ageAt(day(1500, 1, 1), day(1492, 1, 1))).toBe(0);
  });
});

describe("birthYearFromAge", () => {
  it("121 ans au 14 Germinal 1492, ne un 3 Messidor : 1370", () => {
    expect(birthYearFromAge(121, MESSIDOR, 3, day(1492, GERMINAL, 14))).toBe(1370);
  });

  it("anniversaire le jour meme : pas de retrait", () => {
    expect(birthYearFromAge(121, GERMINAL, 14, day(1492, GERMINAL, 14))).toBe(1371);
  });

  it("anniversaire deja passe : annee du jour moins l'age", () => {
    expect(birthYearFromAge(121, GERMINAL, 3, day(1492, MESSIDOR, 14))).toBe(1371);
  });

  it("sans mois : annee du jour moins l'age", () => {
    expect(birthYearFromAge(121, null, null, day(1492, GERMINAL, 14))).toBe(1371);
  });

  it("aller-retour : ageAt redonne l'age saisi, mois de longueurs differentes", () => {
    // Mois de 28, 31 et 30 jours : les jours valides different d'un mois a l'autre.
    const today = day(200, 2, 31);
    for (const [month, d] of [[1, 28], [2, 31], [3, 30], [3, 1]] as const) {
      const year = birthYearFromAge(40, month, d, today);
      expect(ageAt(day(year, month, d), today)).toBe(40);
    }
  });

  it("mois de longueurs differentes : le 28 du premier mois precede le 1er du deuxieme", () => {
    const today = day(200, 2, 1);
    expect(birthYearFromAge(10, 1, 28, today)).toBe(190);
    expect(birthYearFromAge(10, 2, 1, today)).toBe(190);
    expect(birthYearFromAge(10, 2, 2, today)).toBe(189);
  });
});
