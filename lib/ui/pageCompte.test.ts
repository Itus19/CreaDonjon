import { describe, expect, it } from "vitest";
import { confirmationValide, entreesSommaire, motsDePasseDifferents, partiesContexte, sectionActive } from "./pageCompte";

describe("ligne de contexte (V3.1-80)", () => {
  it("omet les zéros, dans l'ordre mène, joue, solo", () => {
    expect(partiesContexte({ mene: 1, joue: 3, solo: 0 })).toEqual([
      { cle: "mene", nombre: 1 },
      { cle: "joue", nombre: 3 },
    ]);
    expect(partiesContexte({ mene: 0, joue: 0, solo: 2 })).toEqual([{ cle: "solo", nombre: 2 }]);
  });
  it("aucun monde : aucune partie", () => {
    expect(partiesContexte({ mene: 0, joue: 0, solo: 0 })).toEqual([]);
  });
});

describe("sommaire (V3.1-80)", () => {
  it("Apparence n'existe que si elle est fournie", () => {
    expect(entreesSommaire({ aRejointParUnLien: false, avecApparence: false })).toEqual(["identite", "connexion", "langue", "suppression"]);
    expect(entreesSommaire({ aRejointParUnLien: true, avecApparence: true })).toEqual([
      "identite", "connexion", "invitation", "apparence", "langue", "suppression",
    ]);
  });
});

describe("section active au défilement", () => {
  const ordre = ["identite", "connexion", "langue"] as const;
  it("la première section visible, dans l'ordre de la page", () => {
    expect(sectionActive(ordre, new Set(["langue", "connexion"]), "identite")).toBe("connexion");
  });
  it("aucune visible : on garde l'actuelle", () => {
    expect(sectionActive(ordre, new Set(), "connexion")).toBe("connexion");
  });
});

describe("saisies", () => {
  it("mots de passe différents", () => {
    expect(motsDePasseDifferents("abc", "abd")).toBe(true);
    expect(motsDePasseDifferents("abc", "abc")).toBe(false);
    expect(motsDePasseDifferents("", "")).toBe(false);
  });
  it("confirmation exacte", () => {
    expect(confirmationValide("SUPPRIMER", "SUPPRIMER")).toBe(true);
    expect(confirmationValide("supprimer", "SUPPRIMER")).toBe(false);
  });
});
