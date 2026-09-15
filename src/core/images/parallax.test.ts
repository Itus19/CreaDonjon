import { describe, expect, it } from "vitest";
import { parallaxProgress, parallaxShiftPx, parallaxTravelPx } from "./parallax";

describe("parallaxProgress", () => {
  // La course va du moment ou le cadre entre par le bas de la fenetre
  // (progression 0) a celui ou il sort par le haut (progression 1). Le
  // denominateur est donc la hauteur de fenetre PLUS celle du cadre : c'est
  // la distance reellement parcourue, pas la seule hauteur visible.
  it("vaut 0 quand le cadre touche tout juste le bas de la fenetre", () => {
    expect(parallaxProgress({ frameTop: 800, frameHeight: 200, viewportHeight: 800 })).toBe(0);
  });

  it("vaut 1 quand le cadre vient de sortir par le haut", () => {
    expect(parallaxProgress({ frameTop: -200, frameHeight: 200, viewportHeight: 800 })).toBe(1);
  });

  it("vaut 0,5 a mi-course", () => {
    expect(parallaxProgress({ frameTop: 300, frameHeight: 200, viewportHeight: 800 })).toBeCloseTo(0.5, 5);
  });

  // Hors champ, la valeur se bloque aux bornes : sans cela, une fiche longue
  // accumulerait un decalage de plusieurs milliers de pixels et l'image
  // sortirait de son cadre.
  it("se borne au-dela de la course", () => {
    expect(parallaxProgress({ frameTop: 5000, frameHeight: 200, viewportHeight: 800 })).toBe(0);
    expect(parallaxProgress({ frameTop: -5000, frameHeight: 200, viewportHeight: 800 })).toBe(1);
  });

  // Fenetre de hauteur nulle : arrive au premier rendu, dans un onglet cache,
  // ou dans un conteneur encore replie. Jamais de division par zero, et une
  // image immobile plutot qu'une image jetee hors de son cadre.
  it("renvoie 0 quand la course serait nulle", () => {
    expect(parallaxProgress({ frameTop: 0, frameHeight: 0, viewportHeight: 0 })).toBe(0);
  });
});

describe("parallaxTravelPx", () => {
  it("prend l'intensite en pourcentage de la hauteur du cadre", () => {
    expect(parallaxTravelPx(300, 20)).toBe(60);
    expect(parallaxTravelPx(300, 40)).toBe(120);
  });

  // C'est ce qui fait du curseur son propre interrupteur : a 0, aucune course,
  // donc aucun decalage, et le composant client n'a plus rien a calculer.
  it("ne bouge pas a intensite nulle", () => {
    expect(parallaxTravelPx(300, 0)).toBe(0);
  });

  it("borne une intensite hors plage plutot que de la propager", () => {
    expect(parallaxTravelPx(300, -10)).toBe(0);
    expect(parallaxTravelPx(300, 400)).toBe(120);
  });
});

describe("parallaxShiftPx", () => {
  // L'image est plus haute que son cadre d'exactement `travel`. On la glisse
  // vers le haut a mesure que la progression avance : a 0 on voit son sommet,
  // a 1 son pied. Jamais de vide, quelle que soit la position.
  it("glisse de zero a toute la course", () => {
    expect(parallaxShiftPx(0, 60)).toBe(0);
    expect(parallaxShiftPx(1, 60)).toBe(-60);
    expect(parallaxShiftPx(0.5, 60)).toBe(-30);
  });

  it("arrondit au pixel — un decalage fractionnaire fait vibrer le texte voisin", () => {
    expect(parallaxShiftPx(1 / 3, 61)).toBe(-20);
  });
});
