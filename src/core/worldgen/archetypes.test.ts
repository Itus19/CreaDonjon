import { describe, expect, it } from "vitest";
import { ARCHETYPES_DE_DEPART, archetypeParCle, zLifeArchetype } from "./archetypes";

describe("archétypes de vie (V3.2-29)", () => {
  it("la liste de départ compte une quinzaine d'archétypes, tous valides", () => {
    expect(ARCHETYPES_DE_DEPART.length).toBeGreaterThanOrEqual(15);
    for (const a of ARCHETYPES_DE_DEPART) expect(zLifeArchetype.safeParse(a).success).toBe(true);
  });

  it("chaque clé est unique", () => {
    const cles = ARCHETYPES_DE_DEPART.map((a) => a.key);
    expect(new Set(cles).size).toBe(cles.length);
  });

  it("retrouve un archétype par sa clé", () => {
    expect(archetypeParCle("pilier_de_bar")?.label).toBe("Pilier de bar");
    expect(archetypeParCle("inconnu")).toBeNull();
  });

  it("refuse un créneau hors des heures de la journée ou une probabilité hors de 0 à 1", () => {
    const base = { key: "x", label: "X", jitter_minutes: 0, absence_days_per_10: 0 };
    expect(zLifeArchetype.safeParse({ ...base, routine: [{ where: "home", from: 0, to: 25, days: "all", chance: 1 }] }).success).toBe(false);
    expect(zLifeArchetype.safeParse({ ...base, routine: [{ where: "home", from: 0, to: 10, days: "all", chance: 1.5 }] }).success).toBe(false);
    expect(zLifeArchetype.safeParse({ ...base, routine: [{ where: "lune", from: 0, to: 10, days: "all", chance: 1 }] }).success).toBe(false);
  });

  it("refuse un créneau vide (même heure de début et de fin)", () => {
    const base = { key: "x", label: "X", jitter_minutes: 0, absence_days_per_10: 0 };
    expect(zLifeArchetype.safeParse({ ...base, routine: [{ where: "home", from: 8, to: 8, days: "all", chance: 1 }] }).success).toBe(false);
  });

  it("accepte un cycle personnel (tours de garde) et refuse un jour hors du cycle", () => {
    const base = { key: "x", label: "X", jitter_minutes: 0, absence_days_per_10: 0 };
    const creneau = (on: number[]) => ({ where: "street", from: 6, to: 14, days: { cycle: 3, on }, chance: 1 });
    expect(zLifeArchetype.safeParse({ ...base, routine: [creneau([0])] }).success).toBe(true);
    expect(zLifeArchetype.safeParse({ ...base, routine: [creneau([3])] }).success).toBe(false);
  });
});
