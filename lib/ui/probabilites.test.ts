import { describe, expect, it } from "vitest";
import { ABREVIATION_CARAC, bornerDd, nomsCourts, signe } from "./probabilites";
import { ABILITIES } from "@/src/core/rules/abilities";

describe("bornerDd", () => {
  it("garde un DD valide", () => {
    expect(bornerDd(15)).toBe(15);
  });
  it("borne à 5 et à 30", () => {
    expect(bornerDd(4)).toBe(5);
    expect(bornerDd(31)).toBe(30);
    expect(bornerDd(-10)).toBe(5);
  });
  it("arrondit un nombre à virgule et replie un non-nombre sur 5", () => {
    expect(bornerDd(14.6)).toBe(15);
    expect(bornerDd(Number.NaN)).toBe(5);
  });
});

describe("ABREVIATION_CARAC", () => {
  it("couvre les six caractéristiques", () => {
    expect(ABILITIES.map((a) => ABREVIATION_CARAC[a])).toEqual(["FOR", "DEX", "CON", "INT", "SAG", "CHA"]);
  });
});

describe("signe", () => {
  it("préfixe + aux valeurs positives ou nulles", () => {
    expect(signe(3)).toBe("+3");
    expect(signe(0)).toBe("+0");
    expect(signe(-1)).toBe("-1");
  });
});

describe("nomsCourts", () => {
  it("garde le prénom quand il suffit à distinguer", () => {
    expect(nomsCourts(["Naivara Lune", "Brom Tisonnier"], false)).toEqual(["Naivara", "Brom"]);
  });
  it("retire les mots communs en tête (« PJ Testeuse A », « PJ Testeur B »)", () => {
    expect(nomsCourts(["PJ Testeuse A", "PJ Testeur B"], false)).toEqual(["Testeuse", "Testeur"]);
  });
  it("garde le nom entier quand le premier mot ne distingue pas", () => {
    expect(nomsCourts(["Kor le Rouge", "Kor le Noir"], false)).toEqual(["Rouge", "Noir"]);
    expect(nomsCourts(["Mira Vale", "Mira Stone"], false)).toEqual(["Vale", "Stone"]);
  });
  it("au téléphone : la plus courte abréviation (4 lettres au moins) qui reste distincte", () => {
    expect(nomsCourts(["Naivara Lune", "Brom Tisonnier"], true)).toEqual(["Naiv", "Brom"]);
    expect(nomsCourts(["PJ Testeuse A", "PJ Testeur B"], true)).toEqual(["Testeus", "Testeur"]);
  });
  it("un seul PJ : son prénom", () => {
    expect(nomsCourts(["Naivara Lune"], false)).toEqual(["Naivara"]);
  });
});
