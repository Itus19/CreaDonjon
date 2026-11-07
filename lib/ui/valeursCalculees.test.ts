import { describe, expect, it } from "vitest";
import type { BonusDie } from "@/src/core/rules/sheet";
import { bonusAvecDes, complementDes, desEnTexte, lignesSensVitesses, plageCritique, sourcesDesTexte, titreAvecDes } from "./valeursCalculees";

const BENEDICTION: BonusDie = { count: 1, faces: 4, label: "Bénédiction", source: "effect:benediction" };

describe("dés de bonus", () => {
  it("écrit « +3 + 1d4 » quand un dé s'ajoute, « +3 » sinon", () => {
    expect(bonusAvecDes(3, [BENEDICTION])).toBe("+3 + 1d4");
    expect(bonusAvecDes(3, [])).toBe("+3");
    expect(bonusAvecDes(-1, [BENEDICTION])).toBe("-1 + 1d4");
  });

  it("assemble plusieurs dés et leurs sources", () => {
    const deux = [BENEDICTION, { count: 1, faces: 6, label: "Inspiration", source: "x" }];
    expect(desEnTexte(deux)).toBe("1d4 + 1d6");
    expect(complementDes(deux)).toBe("+1d4+1d6");
    expect(complementDes([])).toBe("");
    expect(sourcesDesTexte(deux)).toBe("Bénédiction : 1d4\nInspiration : 1d6");
  });

  it("ajoute les sources des dés au survol, et rien sans dés", () => {
    expect(titreAvecDes("Lancer", [])).toBe("Lancer");
    expect(titreAvecDes("Lancer", [BENEDICTION])).toBe("Lancer\nBénédiction : 1d4");
  });
});

describe("plage de critique", () => {
  it("n'annonce rien pour le 20 seul", () => {
    expect(plageCritique(20)).toBeNull();
    expect(plageCritique(19)).toBe("19-20");
    expect(plageCritique(18)).toBe("18-20");
  });
});

describe("sens et vitesses", () => {
  it("convertit les pieds en mètres pour les vitesses, garde les mètres des sens", () => {
    const lignes = lignesSensVitesses({
      speeds: { fly: { value: 30, sources: [{ label: "Ailes", value: 30 }] } },
      senses: { darkvision: { value: 18, sources: [{ label: "Elfe", value: 18 }] } },
    });
    expect(lignes).toEqual([
      { genre: "vitesse", cle: "fly", metres: 9, sources: "Ailes +30" },
      { genre: "sens", cle: "darkvision", metres: 18, sources: "Elfe +18" },
    ]);
  });

  it("ne rend rien sans sens ni vitesse spéciale", () => {
    expect(lignesSensVitesses({ speeds: {}, senses: {} })).toEqual([]);
  });
});
