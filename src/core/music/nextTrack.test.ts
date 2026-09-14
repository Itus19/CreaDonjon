import { describe, it, expect } from "vitest";
import { nextTrackIndex } from "./nextTrack";

describe("nextTrackIndex (V2.1-6, lot 2 — enchaînement et boucle)", () => {
  it("avance à la piste suivante", () => {
    expect(nextTrackIndex(0, 3, false)).toBe(1);
    expect(nextTrackIndex(1, 3, false)).toBe(2);
  });

  it("s'arrête en fin de liste quand la boucle est désactivée", () => {
    expect(nextTrackIndex(2, 3, false)).toBeNull();
  });

  it("revient à la première piste en fin de liste quand la boucle est activée", () => {
    expect(nextTrackIndex(2, 3, true)).toBe(0);
  });

  it("rejoue la piste unique d'un bloc qui boucle", () => {
    // Le cas le plus courant d'une ambiance : une seule piste, en boucle.
    expect(nextTrackIndex(0, 1, true)).toBe(0);
  });

  it("s'arrête après la piste unique d'un bloc qui ne boucle pas", () => {
    expect(nextTrackIndex(0, 1, false)).toBeNull();
  });

  it("ne boucle pas sur une liste vide — il n'y aurait rien à rejouer", () => {
    expect(nextTrackIndex(0, 0, true)).toBeNull();
    expect(nextTrackIndex(0, 0, false)).toBeNull();
  });

  it("s'arrête plutôt que de repartir depuis un index hors liste", () => {
    // Une piste retiree pendant la lecture peut laisser l'index au-dela de la
    // liste : mieux vaut se taire que rejouer une piste au hasard.
    expect(nextTrackIndex(7, 3, false)).toBeNull();
  });

  it("une boucle ramène au début même depuis un index hors liste", () => {
    expect(nextTrackIndex(7, 3, true)).toBe(0);
  });
});
