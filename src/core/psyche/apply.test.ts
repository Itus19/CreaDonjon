import { describe, expect, it } from "vitest";
import { applyDelta, clamp, replayDeltas } from "./apply";

describe("clamp", () => {
  it("borne aux extremes", () => {
    expect(clamp(150, -100, 100)).toBe(100);
    expect(clamp(-150, -100, 100)).toBe(-100);
    expect(clamp(0, -100, 100)).toBe(0);
  });
});

describe("applyDelta", () => {
  it("applique le plein effet au centre exact (current = 0)", () => {
    expect(applyDelta(0, 10)).toBe(10);
    expect(applyDelta(0, -10)).toBe(-10);
  });

  it("amortit un mouvement qui s'eloigne du centre", () => {
    // current=80, delta=+10, meme signe -> amorti a 10 * (1 - 80/100) = 2
    expect(applyDelta(80, 10)).toBe(82);
    expect(applyDelta(-80, -10)).toBe(-82);
  });

  it("applique le plein effet a un mouvement qui revient vers le centre", () => {
    // current=80, delta=-10, signe oppose -> aucun amortissement
    expect(applyDelta(80, -10)).toBe(70);
    expect(applyDelta(-80, 10)).toBe(-70);
  });

  it("ne depasse jamais les bornes -100/+100, meme apres de nombreux deltas extremes", () => {
    let value = 0;
    for (let i = 0; i < 50; i++) value = applyDelta(value, 100);
    expect(value).toBeLessThanOrEqual(100);
    expect(value).toBeGreaterThan(90); // converge vers l'extreme sans jamais le depasser

    let negValue = 0;
    for (let i = 0; i < 50; i++) negValue = applyDelta(negValue, -100);
    expect(negValue).toBeGreaterThanOrEqual(-100);
    expect(negValue).toBeLessThan(-90);
  });

  it("un delta nul ne change jamais la valeur", () => {
    expect(applyDelta(37, 0)).toBe(37);
    expect(applyDelta(-12, 0)).toBe(-12);
  });

  it("apres 50 evenements simules d'ampleur notable (delta +7), aucun axe n'est sature a l'extreme exact (+100)", () => {
    let value = 0;
    for (let i = 0; i < 50; i++) value = applyDelta(value, 7);
    // specs/psyche-pnj.md §1.5 : "+/-100 n'est jamais atteint exactement" —
    // c'est ca, la saturation a eviter, pas rester sous la bande extreme
    // (>=67), que 350 points bruts cumules depassent legitimement.
    expect(value).toBeLessThan(100);
  });

  it("un aller-retour de deltas opposes ne revient pas exactement au point de depart (l'amortissement n'est pas symetrique en un pas)", () => {
    const afterAway = applyDelta(0, 50); // plein effet a 0 -> 50
    const afterReturn = applyDelta(afterAway, -50); // retour vers le centre, plein effet -> 0
    expect(afterReturn).toBe(0);
  });
});

describe("replayDeltas", () => {
  it("reproduit exactement applyDelta applique sequentiellement", () => {
    const deltas = [10, 8, -3, 15, -40, 5];
    let expected = 0;
    for (const d of deltas) expected = applyDelta(expected, d);
    expect(replayDeltas(deltas)).toBe(expected);
  });

  it("une liste vide reste au centre neutre", () => {
    expect(replayDeltas([])).toBe(0);
  });
});
