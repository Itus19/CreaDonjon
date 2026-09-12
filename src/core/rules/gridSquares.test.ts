import { describe, it, expect } from "vitest";
import { squaresFromMeters, SQUARE_SIZE_M } from "./gridSquares";
import { ftToM } from "./encumbrance";

describe("squaresFromMeters", () => {
  it("compte une case par tranche de 1,5 m", () => {
    expect(squaresFromMeters(1.5)).toBe(1);
    expect(squaresFromMeters(3)).toBe(2);
    expect(squaresFromMeters(9)).toBe(6);
  });

  it("arrondit toujours a la case inferieure", () => {
    expect(squaresFromMeters(3.4)).toBe(2);
    expect(squaresFromMeters(4.4)).toBe(2);
    expect(squaresFromMeters(4.5)).toBe(3);
    expect(squaresFromMeters(1.4)).toBe(0);
  });

  it("rend 0 pour une vitesse nulle", () => {
    expect(squaresFromMeters(0)).toBe(0);
  });

  /**
   * Le garde-fou qui compte vraiment : `ftToM` arrondit au dixieme, donc
   * 30 pieds valent 9,1 m et non 9. Compter les cases depuis cette valeur
   * affichee doit quand meme redonner le compte du SRD (1 case = 5 pieds),
   * sans quoi la fiche afficherait deux mesures qui se contredisent.
   */
  it("redonne le compte du SRD pour chaque vitesse standard", () => {
    for (const ft of [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 60]) {
      expect(squaresFromMeters(ftToM(ft))).toBe(ft / 5);
    }
  });

  it("expose la taille de case utilisee a la table", () => {
    expect(SQUARE_SIZE_M).toBe(1.5);
  });
});
