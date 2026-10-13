import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { validateBlockData } from "../schemas/rule-blocks/blocks";

/**
 * V3.1-121 — `data/srd/modifiers-2024.json` est de la DONNÉE saisie à la
 * main, comme `triggers-2024.json` : ce qui peut se tromper sans que rien
 * ne le dise. Une faute de frappe dans une clé attacherait l'effet à une
 * fiche inexistante ; la Ténacité naine resterait ignorée en silence.
 */

const RAW = JSON.parse(readFileSync(resolve(process.cwd(), "data/srd/modifiers-2024.json"), "utf-8")) as Record<
  string,
  { _regle?: string; modifiers?: unknown[] }
>;

const SRD = JSON.parse(readFileSync(resolve(process.cwd(), "data/srd/srd-2024.json"), "utf-8")) as Record<
  string,
  { index?: string }[]
>;

const entrees = Object.entries(RAW).filter(([k]) => !k.startsWith("_"));

describe("les effets passifs SRD écrits à la main", () => {
  it("chaque bloc produit est un bloc `modifiers` valide, non vide", () => {
    for (const [key, value] of entrees) {
      expect(value.modifiers?.length, key).toBeGreaterThan(0);
      expect(() => validateBlockData("modifiers", { modifiers: value.modifiers }), key).not.toThrow();
    }
  });

  it("chaque clé désigne une VRAIE entrée du SRD 2024", () => {
    const connues = new Set<string>();
    for (const liste of Object.values(SRD)) {
      if (!Array.isArray(liste)) continue;
      for (const e of liste) if (e?.index) connues.add(e.index);
    }
    for (const [key] of entrees) expect(connues.has(key), `clé inconnue du SRD : ${key}`).toBe(true);
  });

  it("chaque entrée documente la règle qu'elle traduit", () => {
    for (const [key, value] of entrees) expect(value._regle, key).toBeTruthy();
  });

  it("la Ténacité naine : +1 PV max par niveau", () => {
    expect(RAW["dwarven-toughness"].modifiers).toEqual([{ target: "hp.max", op: "add", value: 1, per_level: true }]);
  });
});
