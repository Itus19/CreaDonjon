import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { lbToKg } from "./encumbrance";

/**
 * V3.1-125 — la masse d'armes pesait 0,9 kg sur la fiche. La conversion
 * (`lbToKg`) etait juste : c'est `data/srd/srd-2024.json` qui disait 2 lb
 * au lieu de 4, comme la lance (2 au lieu de 3) et la pique (6 au lieu de
 * 18). Ce test compare chaque arme de corps a corps au tableau des armes du
 * SRD 5.2.1 (`data/srd/en-source/srd-5.2.1-en.txt`, colonne Weight), pour
 * qu'une donnee fausse ne passe plus l'import en silence.
 */

/** Poids en livres, recopies du tableau des armes du SRD 5.2.1. */
const POIDS_SRD_521: Record<string, number> = {
  club: 2, dagger: 1, greatclub: 10, handaxe: 2, javelin: 2, "light-hammer": 2, mace: 4, quarterstaff: 4, sickle: 2, spear: 3,
  battleaxe: 4, flail: 2, glaive: 6, greataxe: 7, greatsword: 6, halberd: 6, lance: 6, longsword: 3, maul: 10, morningstar: 4,
  pike: 18, rapier: 2, scimitar: 3, shortsword: 2, trident: 4, warhammer: 5, "war-pick": 2, whip: 3,
};

const SRD = JSON.parse(readFileSync(resolve(process.cwd(), "data/srd/srd-2024.json"), "utf-8")) as {
  Equipment: { index: string; weight?: number }[];
};

describe("poids des armes de corps a corps (SRD 2024)", () => {
  for (const [index, livres] of Object.entries(POIDS_SRD_521)) {
    it(`${index} pese ${livres} lb`, () => {
      expect(SRD.Equipment.find((e) => e.index === index)?.weight).toBe(livres);
    });
  }

  it("la masse d'armes s'affiche a environ 1,8 kg", () => {
    expect(lbToKg(POIDS_SRD_521.mace)).toBeCloseTo(1.8, 1);
  });
});
