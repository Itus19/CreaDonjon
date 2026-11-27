import { describe, expect, it } from "vitest";
import { cibleDepuisAdresse, rondsDuRail } from "./railJeu";

type Zone = "engaged" | "near" | "far";
const p = (id: string, zone: Zone) => ({ entityId: id, name: id, zone });
const s = (id: string, zone: Zone) => ({ id, name: id, trait: "", zone });

describe("rondsDuRail (V3.2-55)", () => {
  it("range par distance, les fiches avant les esquisses d'une même zone", () => {
    const { visibles, autres } = rondsDuRail([p("loin", "far"), p("proche", "near"), p("contact", "engaged")], [s("esquisse", "engaged")]);
    expect(visibles.map((r) => r.id)).toEqual(["contact", "esquisse", "proche", "loin"]);
    expect(autres).toBe(0);
  });

  it("huit présents : six visages puis « +2 »", () => {
    const present = Array.from({ length: 8 }, (_, i) => p(`p${i}`, "near"));
    const { visibles, autres } = rondsDuRail(present, []);
    expect(visibles).toHaveLength(6);
    expect(autres).toBe(2);
  });

  it("exactement six : aucun « +x »", () => {
    const present = Array.from({ length: 6 }, (_, i) => p(`p${i}`, "near"));
    expect(rondsDuRail(present, []).autres).toBe(0);
  });
});

describe("cibleDepuisAdresse (V3.2-57)", () => {
  it("reconnaît une fiche et une règle de ce monde", () => {
    expect(cibleDepuisAdresse("/m/valdoria/joueur/wiki/mabelle", "valdoria")).toEqual({ type: "fiche", cle: "mabelle" });
    expect(cibleDepuisAdresse("/m/valdoria/joueur/regles/grappled", "valdoria")).toEqual({ type: "regle", cle: "grappled" });
  });

  it("laisse passer un autre monde, une autre section, une requête ou un sous-chemin", () => {
    expect(cibleDepuisAdresse("/m/autre/joueur/wiki/mabelle", "valdoria")).toBeNull();
    expect(cibleDepuisAdresse("/m/valdoria/joueur/notes/x", "valdoria")).toBeNull();
    expect(cibleDepuisAdresse("/m/valdoria/joueur/wiki?accueil=1", "valdoria")).toBeNull();
    expect(cibleDepuisAdresse("/m/valdoria/joueur/wiki/mabelle/edit", "valdoria")).toBeNull();
    expect(cibleDepuisAdresse("/m/valdoria/joueur/wiki", "valdoria")).toBeNull();
  });
});

describe("cibleDepuisAdresse — règles sans « joueur » (test du 27 novembre)", () => {
  it("reconnaît /m/<monde>/regles/<clé>, que posent les actions de la fiche", () => {
    expect(cibleDepuisAdresse("/m/banc-d-essai/regles/greatsword", "banc-d-essai")).toEqual({ type: "regle", cle: "greatsword" });
  });
  it("laisse passer les pages de l'atelier et un wiki hors coquille joueur", () => {
    expect(cibleDepuisAdresse("/m/banc-d-essai/regles/nouveau-sort", "banc-d-essai")).toBeNull();
    expect(cibleDepuisAdresse("/m/banc-d-essai/joueur/regles/non-jouables", "banc-d-essai")).toBeNull();
    expect(cibleDepuisAdresse("/m/banc-d-essai/wiki/mabelle", "banc-d-essai")).toBeNull();
  });
});
