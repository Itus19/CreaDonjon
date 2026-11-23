import { describe, expect, it } from "vitest";
import { hasReachedNextLevel, nextLevelThreshold, jaugeXp, XP_LEVEL_THRESHOLDS } from "./experience";

describe("nextLevelThreshold", () => {
  it("renvoie le seuil du niveau suivant", () => {
    expect(nextLevelThreshold(1)).toBe(300);
    expect(nextLevelThreshold(19)).toBe(355000);
  });

  it("renvoie null au niveau maximum, aucun seuil suivant", () => {
    expect(nextLevelThreshold(20)).toBeNull();
  });
});

describe("hasReachedNextLevel", () => {
  it("faux juste en dessous du seuil, vrai a partir du seuil", () => {
    expect(hasReachedNextLevel(1, 299)).toBe(false);
    expect(hasReachedNextLevel(1, 300)).toBe(true);
    expect(hasReachedNextLevel(1, 301)).toBe(true);
  });

  it("toujours faux au niveau maximum, quel que soit le PX", () => {
    expect(hasReachedNextLevel(20, XP_LEVEL_THRESHOLDS[19] + 1_000_000)).toBe(false);
  });
});

describe("jaugeXp (AG-4)", () => {
  it("au seuil exact d'un niveau, la progression repart de zéro", () => {
    expect(jaugeXp(3, 900)).toEqual({ dansNiveau: 0, versSuivant: 1800, pourcentage: 0, total: 900, niveauSuivant: 4 });
  });

  it("compte ce qui est gagné depuis le seuil du niveau", () => {
    expect(jaugeXp(3, 1800)).toEqual({ dansNiveau: 900, versSuivant: 1800, pourcentage: 50, total: 1800, niveauSuivant: 4 });
  });

  it("un personnage créé au niveau 3 sans XP n'affiche pas un nombre négatif", () => {
    expect(jaugeXp(3, 0).dansNiveau).toBe(0);
    expect(jaugeXp(3, 0).pourcentage).toBe(0);
  });

  it("plafonne à 100 % quand la montée de niveau est due", () => {
    expect(jaugeXp(3, 3000).pourcentage).toBe(100);
  });

  it("au niveau 20, pas de niveau suivant", () => {
    expect(jaugeXp(20, 400000)).toEqual({ dansNiveau: 0, versSuivant: 0, pourcentage: 100, total: 400000, niveauSuivant: null });
  });
});
