import { describe, expect, it } from "vitest";
import { entreesMenuRegle, estModifieeDansVariante, lienRegleWiki, type DrapeauxRegle } from "./regleEcran";

const base: DrapeauxRegle = { playerRestricted: false, isHomebrew: false, houseVersion: false, isOfficialBase: false, typeModifiable: true };

describe("entreesMenuRegle", () => {
  it("n'offre jamais « Modifier » sur une règle de base officielle", () => {
    const e = entreesMenuRegle({ ...base, isOfficialBase: true, isHomebrew: true, houseVersion: true });
    expect(e).not.toContain("modifier");
    expect(e).not.toContain("versionMaison");
  });
  it("propose la version maison seulement pour une règle de la variante sans copie", () => {
    expect(entreesMenuRegle(base)).toContain("versionMaison");
    expect(entreesMenuRegle({ ...base, houseVersion: true })).not.toContain("versionMaison");
    expect(entreesMenuRegle({ ...base, isHomebrew: true })).not.toContain("versionMaison");
    expect(entreesMenuRegle({ ...base, typeModifiable: false })).not.toContain("versionMaison");
  });
  it("propose « Modifier » pour une fiche maison ou une version maison", () => {
    expect(entreesMenuRegle(base)).not.toContain("modifier");
    expect(entreesMenuRegle({ ...base, isHomebrew: true })).toContain("modifier");
    expect(entreesMenuRegle({ ...base, houseVersion: true })).toContain("modifier");
    expect(entreesMenuRegle({ ...base, houseVersion: true, typeModifiable: false })).not.toContain("modifier");
  });
  it("garde « Supprimer » aux seules fiches maison", () => {
    expect(entreesMenuRegle({ ...base, isHomebrew: true })).toContain("supprimer");
    expect(entreesMenuRegle({ ...base, houseVersion: true })).not.toContain("supprimer");
  });
  it("ne donne rien au joueur", () => {
    expect(entreesMenuRegle({ ...base, playerRestricted: true, isHomebrew: true })).toEqual([]);
  });
});

describe("estModifieeDansVariante", () => {
  it("vrai si un bloc est modifié ou si une version maison existe", () => {
    expect(estModifieeDansVariante([], false)).toBe(false);
    expect(estModifieeDansVariante(["description"], false)).toBe(true);
    expect(estModifieeDansVariante([], true)).toBe(true);
  });
});

describe("lienRegleWiki", () => {
  it("donne l'adresse complète de la page de la règle", () =>
    expect(lienRegleWiki("https://exemple.test", "banc-d-essai", "fireball")).toBe("https://exemple.test/m/banc-d-essai/regles/fireball"));
});
