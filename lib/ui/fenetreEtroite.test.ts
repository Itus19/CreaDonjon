import { describe, expect, it } from "vitest";
import { estFenetreEtroite } from "./fenetreEtroite";

describe("estFenetreEtroite", () => {
  it("est étroite sous 48 rem (768 px)", () => {
    expect(estFenetreEtroite(560)).toBe(true);
    expect(estFenetreEtroite(767)).toBe(true);
  });
  it("ne l'est plus à 48 rem et au-delà, comme le tiroir du sommaire", () => {
    expect(estFenetreEtroite(768)).toBe(false);
    expect(estFenetreEtroite(1200)).toBe(false);
  });
  it("suit la taille de police racine", () => {
    expect(estFenetreEtroite(800, 20)).toBe(true);
  });
});
