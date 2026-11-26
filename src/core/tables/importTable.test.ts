import { describe, expect, it } from "vitest";
import { lireTableImportee } from "./importTable";

describe("importer une table depuis un fichier (AG-21)", () => {
  it("un texte : une entrée par ligne, lignes vides et commentaires ignorés, plages 1 à n", () => {
    const r = lireTableImportee("Aldric\n\n# prénoms\nBrune\n  Cael  \n");
    expect(r).toEqual({
      ok: true,
      table: { die: "d3", entries: [
        { range: { min: 1, max: 1 }, weight: 1, text: "Aldric" },
        { range: { min: 2, max: 2 }, weight: 1, text: "Brune" },
        { range: { min: 3, max: 3 }, weight: 1, text: "Cael" },
      ] },
    });
  });

  it("un JSON : clé, attribution, paliers et poids ; les plages suivent les poids", () => {
    const r = lireTableImportee(
      JSON.stringify({ key: "noms-humain", attribution: "MIT, Tom Gray", entries: [{ text: "Aseir", tier: "masculin" }, { text: "Atala", tier: "feminin", weight: 2 }] })
    );
    expect(r).toEqual({
      ok: true,
      table: {
        key: "noms-humain",
        attribution: "MIT, Tom Gray",
        die: "d3",
        entries: [
          { range: { min: 1, max: 1 }, weight: 1, text: "Aseir", tier: "masculin" },
          { range: { min: 2, max: 3 }, weight: 2, text: "Atala", tier: "feminin" },
        ],
      },
    });
  });

  it("refuse un fichier vide, un JSON mal formé, une entrée sans texte, et plus de 1000 entrées", () => {
    expect(lireTableImportee("  \n").ok).toBe(false);
    expect(lireTableImportee("{ pas du json").ok).toBe(true); // un texte qui commence par « { » sans être du JSON reste une ligne
    expect(lireTableImportee(JSON.stringify({ entries: [{ text: "" }] })).ok).toBe(false);
    expect(lireTableImportee(Array.from({ length: 1001 }, (_, i) => `n${i}`).join("\n")).ok).toBe(false);
  });
});
