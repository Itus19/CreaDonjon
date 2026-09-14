import { describe, it, expect } from "vitest";
import { FADE_STEP_MS, fadeVolumeAt, fadeStepCount } from "./fade";

describe("fadeVolumeAt (V2.1-6, lot 2)", () => {
  it("part du volume de depart et arrive au volume d'arrivee", () => {
    expect(fadeVolumeAt(0, 1000, 0, 100)).toBe(0);
    expect(fadeVolumeAt(1000, 1000, 0, 100)).toBe(100);
  });

  it("progresse lineairement entre les deux", () => {
    expect(fadeVolumeAt(250, 1000, 0, 100)).toBe(25);
    expect(fadeVolumeAt(500, 1000, 0, 100)).toBe(50);
    expect(fadeVolumeAt(750, 1000, 0, 100)).toBe(75);
  });

  it("descend aussi bien qu'il monte", () => {
    expect(fadeVolumeAt(0, 1000, 100, 0)).toBe(100);
    expect(fadeVolumeAt(500, 1000, 100, 0)).toBe(50);
    expect(fadeVolumeAt(1000, 1000, 100, 0)).toBe(0);
  });

  it("borne au-dela de la duree plutot que de depasser", () => {
    expect(fadeVolumeAt(5000, 1000, 0, 100)).toBe(100);
    expect(fadeVolumeAt(5000, 1000, 100, 0)).toBe(0);
  });

  it("ignore un temps negatif — une horloge qui recule ne doit pas produire un volume hors bornes", () => {
    expect(fadeVolumeAt(-200, 1000, 0, 100)).toBe(0);
    expect(fadeVolumeAt(-200, 1000, 100, 0)).toBe(100);
  });

  it("saute directement au volume d'arrivee si la duree est nulle", () => {
    // Fondu desactive (0 ms) : jamais une division par zero, jamais un NaN
    // transmis a `setVolume`, qui l'accepterait sans rien dire.
    expect(fadeVolumeAt(0, 0, 0, 100)).toBe(100);
    expect(fadeVolumeAt(0, 0, 100, 0)).toBe(0);
  });

  it("rend toujours un entier — `setVolume` attend 0-100 sans decimale", () => {
    for (let t = 0; t <= 1000; t += 37) {
      const v = fadeVolumeAt(t, 1000, 0, 100);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it("respecte des volumes de depart et d'arrivee quelconques", () => {
    expect(fadeVolumeAt(500, 1000, 40, 80)).toBe(60);
  });
});

describe("fadeStepCount", () => {
  it("compte les paliers d'un fondu d'une duree donnee", () => {
    expect(fadeStepCount(1000)).toBe(Math.ceil(1000 / FADE_STEP_MS));
  });

  it("ne demande aucun palier pour un fondu desactive", () => {
    expect(fadeStepCount(0)).toBe(0);
  });

  it("demande au moins un palier des que la duree est non nulle", () => {
    expect(fadeStepCount(1)).toBe(1);
  });
});
