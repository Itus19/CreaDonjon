import { describe, expect, it } from "vitest";
import { formatGameDate } from "./formatDate";
import type { CalendarConfig, GameDate } from "./types";

const CALENDAR: CalendarConfig = {
  months: [
    { name: "janvier", days: 31 },
    { name: "février", days: 28 },
    { name: "mars", days: 31 },
  ],
  daysPerWeek: 7,
  eras: [
    { name: "l'Âge d'Or", startYear: 1000 },
    { name: "l'Âge des Cendres", startYear: 1200 },
  ],
};

function date(partial: Partial<GameDate>): GameDate {
  return { year: 1247, month: null, day: null, precision: "year", end: null, label: null, ...partial };
}

describe("formatGameDate", () => {
  it("le label prime toujours sur la date calculee", () => {
    const d = date({ year: 1, month: 1, day: 1, precision: "day", label: "le Troisième Hiver Noir" });
    expect(formatGameDate(d, CALENDAR)).toBe("le Troisième Hiver Noir");
  });

  it("precision day : jour, mois nomme, annee", () => {
    const d = date({ year: 1247, month: 3, day: 12, precision: "day" });
    expect(formatGameDate(d, CALENDAR)).toBe("12 mars 1247");
  });

  it("precision month : mois nomme, annee", () => {
    const d = date({ year: 1247, month: 3, precision: "month" });
    expect(formatGameDate(d, CALENDAR)).toBe("mars 1247");
  });

  it("precision year : « vers 1200 » est une date valide, sans jour ni mois", () => {
    const d = date({ year: 1200, precision: "year" });
    expect(formatGameDate(d, CALENDAR)).toBe("1200");
  });

  it("precision decade : arrondi a la decennie", () => {
    const d = date({ year: 1247, precision: "decade" });
    expect(formatGameDate(d, CALENDAR)).toBe("années 1240");
  });

  it("precision era : nom de l'ere contenant l'annee", () => {
    expect(formatGameDate(date({ year: 1247, precision: "era" }), CALENDAR)).toBe("l'Âge des Cendres");
    expect(formatGameDate(date({ year: 1050, precision: "era" }), CALENDAR)).toBe("l'Âge d'Or");
  });

  it("precision era sans ere connue pour cette annee : repli sur l'annee brute", () => {
    expect(formatGameDate(date({ year: 500, precision: "era" }), CALENDAR)).toBe("500");
  });

  it("`end` permet une periode : une guerre dure", () => {
    const d = date({ year: 1200, precision: "year", end: { year: 1204, month: null, day: null } });
    expect(formatGameDate(d, CALENDAR)).toBe("1200 – 1204");
  });
});
