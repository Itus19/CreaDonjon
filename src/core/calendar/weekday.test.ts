import { describe, expect, it } from "vitest";
import { weekdayIndexForDate, weekdayNameForDate } from "./weekday";
import { DEFAULT_CALENDAR } from "./defaultCalendar";
import type { CalendarConfig } from "./types";

describe("weekdayIndexForDate", () => {
  it("le 1er jour de l'an 0 tombe sur weekdayEpoch (retour utilisateur : 1er Vendémiaire an 0 = Primidi)", () => {
    expect(weekdayIndexForDate({ year: 0, month: 1, day: 1 }, DEFAULT_CALENDAR)).toBe(0);
    expect(weekdayNameForDate({ year: 0, month: 1, day: 1 }, DEFAULT_CALENDAR)).toBe("Primidi");
  });

  it("avance d'un jour de semaine par jour calendaire", () => {
    expect(weekdayNameForDate({ year: 0, month: 1, day: 2 }, DEFAULT_CALENDAR)).toBe("Duodi");
    expect(weekdayNameForDate({ year: 0, month: 1, day: 3 }, DEFAULT_CALENDAR)).toBe("Tridi");
  });

  it("boucle après le dernier jour de la semaine", () => {
    // Décade de 10 jours : le 11e jour du calendrier retombe sur le premier jour de semaine.
    expect(weekdayNameForDate({ year: 0, month: 1, day: 11 }, DEFAULT_CALENDAR)).toBe("Primidi");
    expect(weekdayNameForDate({ year: 0, month: 1, day: 30 }, DEFAULT_CALENDAR)).toBe("Décadi");
  });

  it("reste cohérent d'un mois à l'autre (mois de 30 jours, décade de 10 : division exacte)", () => {
    expect(weekdayNameForDate({ year: 0, month: 2, day: 1 }, DEFAULT_CALENDAR)).toBe("Primidi");
  });

  it("reste cohérent d'une année à l'autre", () => {
    expect(weekdayNameForDate({ year: 1, month: 1, day: 1 }, DEFAULT_CALENDAR)).toBe("Primidi");
    expect(weekdayNameForDate({ year: 5, month: 3, day: 1 }, DEFAULT_CALENDAR)).toBe("Primidi");
  });

  it("une annee avant l'an 0 retombe sur un jour de semaine valide (modulo jamais negatif)", () => {
    // Dernier jour de l'an -1 = veille du 1er Vendémiaire an 0 (Primidi) => Décadi.
    expect(weekdayNameForDate({ year: -1, month: 12, day: 30 }, DEFAULT_CALENDAR)).toBe("Décadi");
    expect(weekdayNameForDate({ year: -1, month: 1, day: 1 }, DEFAULT_CALENDAR)).toBe("Primidi");
  });

  it("weekdayEpoch reglable decale tout le calendrier", () => {
    const shifted: CalendarConfig = { ...DEFAULT_CALENDAR, weekdayEpoch: 3 };
    expect(weekdayNameForDate({ year: 0, month: 1, day: 1 }, shifted)).toBe("Quartidi");
  });

  it("renvoie null sans jour de semaine defini, ou sans mois/jour (precision plus large)", () => {
    const noWeekdays: CalendarConfig = { ...DEFAULT_CALENDAR, weekdays: [] };
    expect(weekdayIndexForDate({ year: 0, month: 1, day: 1 }, noWeekdays)).toBeNull();
    expect(weekdayIndexForDate({ year: 1247, month: null, day: null }, DEFAULT_CALENDAR)).toBeNull();
  });
});
