import { describe, expect, it } from "vitest";
import { dateWithSeason, seasonOf, yearPhase } from "./season";

describe("yearPhase", () => {
  it("met le cœur de l'hiver au premier jour par défaut, l'été à mi-année", () => {
    expect(yearPhase({ dayOfYear: 1, yearLength: 360, latitude: 45 })).toBeCloseTo(0, 5);
    expect(yearPhase({ dayOfYear: 181, yearLength: 360, latitude: 45 })).toBeCloseTo(0.5, 5);
  });

  it("suit le jour du cœur de l'hiver réglé dans le calendrier", () => {
    expect(yearPhase({ dayOfYear: 31, yearLength: 360, latitude: 45, midwinterDay: 31 })).toBeCloseTo(0, 5);
    expect(yearPhase({ dayOfYear: 1, yearLength: 360, latitude: 45, midwinterDay: 31 })).toBeCloseTo(330 / 360, 5);
  });

  it("décale d'une demi-année dans l'hémisphère sud", () => {
    expect(yearPhase({ dayOfYear: 1, yearLength: 360, latitude: -30 })).toBeCloseTo(0.5, 5);
  });

  it("refuse une année sans jours", () => {
    expect(() => yearPhase({ dayOfYear: 1, yearLength: 0, latitude: 0 })).toThrow(RangeError);
  });
});

describe("seasonOf", () => {
  it("découpe l'année en quatre saisons centrées sur les solstices", () => {
    expect(seasonOf(0)).toBe("winter");
    expect(seasonOf(0.95)).toBe("winter");
    expect(seasonOf(0.25)).toBe("spring");
    expect(seasonOf(0.5)).toBe("summer");
    expect(seasonOf(0.75)).toBe("autumn");
  });
});

describe("dateWithSeason (V3.2-59)", () => {
  it("la date puis la saison", () => {
    expect(dateWithSeason("jeudi 14 brumaire 1247", "autumn")).toBe("jeudi 14 brumaire 1247, automne");
  });
  it("une seule des deux, ou rien", () => {
    expect(dateWithSeason(null, "winter")).toBe("hiver");
    expect(dateWithSeason("14 brumaire 1247", null)).toBe("14 brumaire 1247");
    expect(dateWithSeason(null, null)).toBeNull();
  });
});
