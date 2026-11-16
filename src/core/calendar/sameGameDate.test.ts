import { describe, expect, it } from "vitest";
import { sameGameDate } from "./sameGameDate";
import type { GameDate } from "./types";

const naissance: GameDate = { year: 1398, month: 5, day: 21, precision: "day", end: null, label: null };

describe("sameGameDate", () => {
  it("meme date, cles dans un autre ordre (aller-retour jsonb) : egales", () => {
    // Ordre exact rendu par Postgres pour la naissance de Terk (8 novembre 2026).
    const depuisJsonb = JSON.parse('{"day": 21, "end": null, "year": 1398, "label": null, "month": 5, "precision": "day"}') as GameDate;
    expect(sameGameDate(depuisJsonb, naissance)).toBe(true);
  });

  it("deux absences : egales", () => {
    expect(sameGameDate(null, undefined)).toBe(true);
  });

  it("une absence contre une date : differentes", () => {
    expect(sameGameDate(null, naissance)).toBe(false);
    expect(sameGameDate(naissance, undefined)).toBe(false);
  });

  it("end et label absents valent null (defauts du schema Zod)", () => {
    const ancienne = { year: 1398, month: 5, day: 21, precision: "day" as const };
    expect(sameGameDate(ancienne, naissance)).toBe(true);
  });

  it("un jour, un mois, une annee ou une precision differents : differentes", () => {
    expect(sameGameDate(naissance, { ...naissance, day: 22 })).toBe(false);
    expect(sameGameDate(naissance, { ...naissance, month: 6 })).toBe(false);
    expect(sameGameDate(naissance, { ...naissance, year: 1399 })).toBe(false);
    expect(sameGameDate(naissance, { ...naissance, precision: "month" })).toBe(false);
  });

  it("une fin de periode ou un libelle differents : differentes", () => {
    expect(sameGameDate(naissance, { ...naissance, end: { year: 1399, month: null, day: null } })).toBe(false);
    expect(sameGameDate(naissance, { ...naissance, label: "Au solstice" })).toBe(false);
  });

  it("deux fins identiques, cles dans un autre ordre : egales", () => {
    const a = { ...naissance, end: { year: 1399, month: 2, day: null } };
    const b = { ...naissance, end: JSON.parse('{"day": null, "year": 1399, "month": 2}') as GameDate["end"] };
    expect(sameGameDate(a, b)).toBe(true);
  });
});
