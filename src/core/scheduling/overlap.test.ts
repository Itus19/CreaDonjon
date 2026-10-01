import { describe, expect, it } from "vitest";
import { classifySession, timeToMinutes, minutesToTime } from "./overlap";

describe("timeToMinutes / minutesToTime", () => {
  it("convertit heure:minute en minutes depuis minuit", () => {
    expect(timeToMinutes("19:00")).toBe(1140);
    expect(timeToMinutes("00:30")).toBe(30);
  });
  it("fait l'aller-retour", () => {
    expect(minutesToTime(timeToMinutes("23:45"))).toBe("23:45");
  });
});

describe("classifySession", () => {
  it("complete quand l'intersection couvre au moins la duree cible", () => {
    expect(classifySession(300, 300)).toBe("full");
    expect(classifySession(360, 300)).toBe("full");
  });
  it("raccourcie quand l'intersection est positive mais sous la cible", () => {
    expect(classifySession(240, 300)).toBe("short");
  });
  it("aucune quand l'intersection est nulle ou negative", () => {
    expect(classifySession(0, 300)).toBe("none");
  });
});
