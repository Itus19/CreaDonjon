import { describe, expect, it } from "vitest";
import {
  SEUIL_FERMETURE_PX,
  decalageGlisse,
  doitFermerApresGlisse,
  indexFocusSuivant,
  VITESSE_FERMETURE_PX_PAR_MS,
} from "./feuilleDuBas";

describe("decalageGlisse", () => {
  it("suit le doigt vers le bas", () => {
    expect(decalageGlisse(100, 160)).toBe(60);
  });

  it("ne remonte jamais au-dessus de la position de repos", () => {
    expect(decalageGlisse(100, 40)).toBe(0);
  });
});

describe("doitFermerApresGlisse", () => {
  it("ferme au-delà du seuil de distance", () => {
    expect(doitFermerApresGlisse(SEUIL_FERMETURE_PX + 1, 2000)).toBe(true);
  });

  it("revient en deçà du seuil quand le geste est lent", () => {
    expect(doitFermerApresGlisse(SEUIL_FERMETURE_PX - 1, 2000)).toBe(false);
    expect(doitFermerApresGlisse(0, 300)).toBe(false);
  });

  it("ferme sur un geste vif, même court", () => {
    // 40 px en 40 ms : 1 px/ms, au-dessus de la vitesse nette.
    expect(40 / 40).toBeGreaterThan(VITESSE_FERMETURE_PX_PAR_MS);
    expect(doitFermerApresGlisse(40, 40)).toBe(true);
  });

  it("ignore un frôlement trop court pour être un geste", () => {
    expect(doitFermerApresGlisse(5, 1)).toBe(false);
  });

  it("ne ferme pas un geste vers le haut", () => {
    expect(doitFermerApresGlisse(-200, 50)).toBe(false);
  });
});

describe("indexFocusSuivant", () => {
  it("avance d'un cran", () => {
    expect(indexFocusSuivant(0, 3, false)).toBe(1);
  });

  it("boucle du dernier au premier", () => {
    expect(indexFocusSuivant(2, 3, false)).toBe(0);
  });

  it("recule d'un cran et boucle du premier au dernier", () => {
    expect(indexFocusSuivant(1, 3, true)).toBe(0);
    expect(indexFocusSuivant(0, 3, true)).toBe(2);
  });

  it("part du premier (ou du dernier en arrière) quand le focus est hors de la feuille", () => {
    expect(indexFocusSuivant(-1, 3, false)).toBe(0);
    expect(indexFocusSuivant(-1, 3, true)).toBe(2);
  });

  it("ne renvoie rien d'utilisable sans élément focalisable", () => {
    expect(indexFocusSuivant(-1, 0, false)).toBe(-1);
  });
});
