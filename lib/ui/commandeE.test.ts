import { describe, expect, it } from "vitest";
import { ecartCommandeE, pvSousUnTiers } from "./commandeE";

describe("ecartCommandeE", () => {
  it("champ vide : plus ou moins un", () => {
    expect(ecartCommandeE("", 1)).toBe(1);
    expect(ecartCommandeE("", -1)).toBe(-1);
    expect(ecartCommandeE("   ", 1)).toBe(1);
  });

  it("champ rempli : plus ou moins ce nombre", () => {
    expect(ecartCommandeE("250", 1)).toBe(250);
    expect(ecartCommandeE("7", -1)).toBe(-7);
    expect(ecartCommandeE(" 12 ", 1)).toBe(12);
    expect(ecartCommandeE("+3", -1)).toBe(-3);
  });

  it("un signe moins tapé ne renverse pas la flèche", () => {
    expect(ecartCommandeE("-5", 1)).toBe(5);
    expect(ecartCommandeE("-5", -1)).toBe(-5);
  });

  it("saisie invalide : rien n'est envoyé", () => {
    expect(ecartCommandeE("abc", 1)).toBeNull();
    expect(ecartCommandeE("2,5", 1)).toBeNull();
    expect(ecartCommandeE("2.5", -1)).toBeNull();
    expect(ecartCommandeE("0", 1)).toBeNull();
    expect(ecartCommandeE("1e3", 1)).toBeNull();
    expect(ecartCommandeE("99999999999999999999", 1)).toBeNull();
  });
});

describe("pvSousUnTiers", () => {
  it("danger sous un tiers du maximum, pas à un tiers pile", () => {
    expect(pvSousUnTiers(4, 15)).toBe(true);
    expect(pvSousUnTiers(5, 15)).toBe(false);
    expect(pvSousUnTiers(11, 15)).toBe(false);
    expect(pvSousUnTiers(0, 15)).toBe(true);
  });

  it("jamais de danger sans maximum", () => {
    expect(pvSousUnTiers(0, 0)).toBe(false);
  });
});
