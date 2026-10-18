import { describe, expect, it } from "vitest";
import { decalage, directionGlisse, indexDepart, indexPrecedent, indexSuivant, prenom, rolePosition } from "./carrousel";

describe("indexDepart", () => {
  const ids = ["a", "b", "c"];
  it("ouvre sur « Nouveau » (dernière carte) par défaut", () => {
    expect(indexDepart({ kind: "new" }, ids)).toBe(3);
  });
  it("ouvre sur le PJ visé", () => {
    expect(indexDepart({ kind: "character", entityId: "b" }, ids)).toBe(1);
  });
  it("retombe sur « Nouveau » si le PJ visé est absent de la liste", () => {
    expect(indexDepart({ kind: "character", entityId: "z" }, ids)).toBe(3);
  });
  it("sans PJ : la carte « Nouveau » est seule, à l'index 0", () => {
    expect(indexDepart({ kind: "new" }, [])).toBe(0);
  });
});

describe("bouclage", () => {
  it("suivant boucle de la dernière à la première", () => {
    expect(indexSuivant(3, 4)).toBe(0);
    expect(indexSuivant(0, 4)).toBe(1);
  });
  it("précédent boucle de la première à la dernière", () => {
    expect(indexPrecedent(0, 4)).toBe(3);
    expect(indexPrecedent(2, 4)).toBe(1);
  });
});

describe("decalage et voisines", () => {
  it("donne le décalage signé le plus court", () => {
    expect(decalage(0, 3, 4)).toBe(1); // à droite par bouclage
    expect(decalage(2, 3, 4)).toBe(-1);
    expect(decalage(3, 3, 4)).toBe(0);
    expect(decalage(0, 2, 5)).toBe(-2);
  });
  it("à l'ouverture sur « Nouveau » : le dernier PJ à gauche, le premier à droite", () => {
    // 3 PJ + Nouveau (index 3) centré
    expect(decalage(2, 3, 4)).toBe(-1);
    expect(decalage(0, 3, 4)).toBe(1);
  });
  it("classe centre, voisine, masquée", () => {
    expect(rolePosition(0)).toBe("centre");
    expect(rolePosition(1)).toBe("voisine");
    expect(rolePosition(-1)).toBe("voisine");
    expect(rolePosition(2)).toBe("masquee");
    expect(rolePosition(-3)).toBe("masquee");
  });
});

describe("prenom", () => {
  it("prend le premier mot du nom", () => {
    expect(prenom("Thorgar Brisefer")).toBe("Thorgar");
    expect(prenom("  Naivara ")).toBe("Naivara");
  });
});

describe("directionGlisse", () => {
  it("glisser vers la gauche avance, vers la droite recule", () => {
    expect(directionGlisse(-80)).toBe(1);
    expect(directionGlisse(80)).toBe(-1);
  });
  it("ignore un mouvement trop court", () => {
    expect(directionGlisse(10)).toBe(0);
    expect(directionGlisse(-39)).toBe(0);
  });
});
