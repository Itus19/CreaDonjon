import { describe, expect, it } from "vitest";
import { legendeSources, type SourcesParCase } from "./sourcesCaracteristiques";

/**
 * V3.1-164 (proposition B) : une addition en couleurs dans chaque case, une
 * légende sous les six. La première source d'une case est sa base (grise) ;
 * chaque autre source reçoit une couleur, la même partout où elle revient,
 * dans l'ordre où elle apparaît.
 */
const cases: SourcesParCase = {
  str: [{ label: "Valeur attribuée", value: 12 }],
  dex: [
    { label: "Valeur attribuée", value: 15 },
    { label: "Historique", value: 2 },
  ],
  con: [
    { label: "Valeur attribuée", value: 13 },
    { label: "Amélioration de caractéristique (Rôdeur niv. 4)", value: 1 },
  ],
  int: [{ label: "Valeur attribuée", value: 8 }],
  wis: [
    { label: "Valeur attribuée", value: 14 },
    { label: "Historique", value: 1 },
  ],
  cha: [{ label: "Valeur attribuée", value: 10 }],
};

describe("legendeSources", () => {
  it("chaque source de bonus reçoit une couleur, la même partout, dans l'ordre d'apparition", () => {
    const l = legendeSources(cases);
    expect(l.bonus).toEqual([
      { label: "Historique", couleur: 0 },
      { label: "Amélioration de caractéristique (Rôdeur niv. 4)", couleur: 1 },
    ]);
    expect(l.couleurDe("Historique")).toBe(0);
    expect(l.couleurDe("Amélioration de caractéristique (Rôdeur niv. 4)")).toBe(1);
  });

  it("les bases sont nommées une fois chacune, sans couleur", () => {
    expect(legendeSources(cases).bases).toEqual(["Valeur attribuée"]);
  });

  it("sans aucun bonus : pas d'entrée de bonus dans la légende", () => {
    const l = legendeSources({ str: [{ label: "Valeur attribuée", value: 10 }] });
    expect(l.bonus).toEqual([]);
  });

  it("au-delà des couleurs disponibles, on reprend la première (la légende reste juste)", () => {
    const beaucoup: SourcesParCase = {
      str: [{ label: "Base", value: 10 }, ...Array.from({ length: 6 }, (_, i) => ({ label: `S${i}`, value: 1 }))],
    };
    const l = legendeSources(beaucoup, 5);
    expect(l.couleurDe("S5")).toBe(0);
  });
});
