import { describe, expect, it } from "vitest";
import { applyConcentrationChange, concentratingConditions, CONCENTRATING } from "./concentration";

const bless = { spell_key: "bless", label: "Bénédiction" };
const haste = { spell_key: "haste", label: "Hâte" };

describe("applyConcentrationChange", () => {
  it("poser une concentration sur un personnage qui ne se concentre pas : rien n'est rompu", () => {
    expect(applyConcentrationChange(null, bless)).toEqual({ next: bless, broken: null });
  });

  it("poser une nouvelle remplace la precedente, et la rend comme rompue", () => {
    expect(applyConcentrationChange(bless, haste)).toEqual({ next: haste, broken: bless });
  });

  it("relancer le meme sort ne rompt rien : c'est la meme concentration", () => {
    expect(applyConcentrationChange(bless, { ...bless })).toEqual({ next: bless, broken: null });
  });

  it("rompre retire la concentration et la rend", () => {
    expect(applyConcentrationChange(bless, null)).toEqual({ next: null, broken: bless });
  });

  it("rompre sans concentration ne fait rien", () => {
    expect(applyConcentrationChange(null, null)).toEqual({ next: null, broken: null });
  });
});

describe("concentratingConditions (etat derive des declencheurs)", () => {
  it("ajoute `concentrating` quand une concentration est en cours", () => {
    expect(concentratingConditions(["prone"], bless)).toEqual(["prone", CONCENTRATING]);
  });

  it("n'ajoute rien sans concentration", () => {
    expect(concentratingConditions(["prone"], null)).toEqual(["prone"]);
  });

  it("ne duplique pas une condition `concentrating` deja stockee par une ancienne fiche", () => {
    expect(concentratingConditions([CONCENTRATING], bless)).toEqual([CONCENTRATING]);
  });
});
