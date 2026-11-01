import { describe, expect, it } from "vitest";
import { classeBarre, classesPastille, formaterMoyenne, hauteurBarre, maximumCompteurs } from "./statsJoueur";

describe("hauteurBarre", () => {
  it("remplit exactement la zone pour le maximum, jamais au-delà", () => {
    expect(hauteurBarre(13, 13)).toBe(100);
    expect(hauteurBarre(20, 13)).toBe(100);
  });
  it("est proportionnelle au compteur", () => {
    expect(hauteurBarre(5, 10)).toBe(50);
  });
  it("garde une barre visible au plus petit compteur non nul, et aucune à zéro", () => {
    expect(hauteurBarre(1, 200)).toBe(4);
    expect(hauteurBarre(0, 10)).toBe(0);
    expect(hauteurBarre(3, 0)).toBe(0);
  });
});

describe("maximumCompteurs", () => {
  it("rend le plus grand compteur, 0 sans compteur", () => {
    expect(maximumCompteurs([1, 9, 4])).toBe(9);
    expect(maximumCompteurs([])).toBe(0);
  });
});

describe("formaterMoyenne", () => {
  it("met la virgule française et une décimale", () => {
    expect(formaterMoyenne(11.4, "fr")).toBe("11,4");
    expect(formaterMoyenne(11, "fr")).toBe("11,0");
    expect(formaterMoyenne(11.4, "en")).toBe("11.4");
  });
  it("rend un tiret sans moyenne", () => {
    expect(formaterMoyenne(null, "fr")).toBe("—");
  });
});

describe("classeBarre", () => {
  it("colore le 1 en rouge, le 20 en vert, le reste en accent atténué", () => {
    expect(classeBarre(1)).toBe("bg-danger");
    expect(classeBarre(20)).toBe("bg-success");
    expect(classeBarre(14)).toBe("bg-accent/40");
  });
});

describe("classesPastille", () => {
  it("teinte selon le jeton, accent par défaut", () => {
    expect(classesPastille("success")).toContain("text-success");
    expect(classesPastille("link_rule")).toContain("text-link-rule");
    expect(classesPastille("inconnu")).toContain("text-accent");
  });
});
