import { describe, expect, it } from "vitest";
import { CYCLE_VISIBILITE, annonceVisibilite, devientPlusVisible, niveauSuivant, cycleVisibilite } from "./visibilitePastille";

describe("niveauSuivant", () => {
  it("suit Public, Joueurs, MJ, Privé, puis revient à Public", () => {
    expect(CYCLE_VISIBILITE).toEqual(["public", "players", "gm", "private"]);
    expect(niveauSuivant("public")).toBe("players");
    expect(niveauSuivant("players")).toBe("gm");
    expect(niveauSuivant("gm")).toBe("private");
    expect(niveauSuivant("private")).toBe("public");
  });

  it("ramène au départ après quatre pas", () => {
    for (const depart of CYCLE_VISIBILITE) {
      let n: string = depart;
      for (let i = 0; i < 4; i++) n = niveauSuivant(n);
      expect(n).toBe(depart);
    }
  });

  it("passe à Public depuis campagne, utilisateur ou un niveau inconnu", () => {
    expect(niveauSuivant("campaign")).toBe("public");
    expect(niveauSuivant("user")).toBe("public");
    expect(niveauSuivant("autre")).toBe("public");
  });
});

describe("devientPlusVisible", () => {
  it("n'avertit que lorsqu'on s'ouvre à plus de monde", () => {
    expect(devientPlusVisible("private", "public")).toBe(true);
    expect(devientPlusVisible("gm", "players")).toBe(true);
    expect(devientPlusVisible("campaign", "public")).toBe(true);
    expect(devientPlusVisible("user", "public")).toBe(true);
    expect(devientPlusVisible("public", "players")).toBe(false);
    expect(devientPlusVisible("players", "gm")).toBe(false);
    expect(devientPlusVisible("gm", "private")).toBe(false);
    expect(devientPlusVisible("gm", "gm")).toBe(false);
  });

  it("ne marque plus visible que le pas Privé vers Public dans le cycle", () => {
    const avertis = CYCLE_VISIBILITE.filter((n) =>
      devientPlusVisible(n, niveauSuivant(n)),
    );
    expect(avertis).toEqual(["private"]);
  });
});

describe("annonceVisibilite", () => {
  it("annonce le nouveau niveau, sans avertissement quand on se ferme", () => {
    expect(annonceVisibilite("Rumeurs de Phandaline", "players", "gm")).toEqual(
      {
        objet: "Rumeurs de Phandaline",
        niveau: "gm",
        attention: false,
      },
    );
  });
  it("ajoute l'avertissement quand le bloc redevient visible", () => {
    expect(annonceVisibilite("Rumeurs", "private", "public").attention).toBe(
      true,
    );
  });
});

describe("Privé réservé à l'auteur du bloc (V3.1-64)", () => {
  it("sans Privé, le cycle fait Public → Joueurs → MJ → Public", () => {
    expect(niveauSuivant("gm", true)).toBe("public");
    expect(niveauSuivant("public", true)).toBe("players");
    expect(cycleVisibilite(true)).toEqual(["public", "players", "gm"]);
  });
  it("l'auteur garde les quatre niveaux", () => {
    expect(niveauSuivant("gm")).toBe("private");
    expect(cycleVisibilite()).toEqual(["public", "players", "gm", "private"]);
  });
});
