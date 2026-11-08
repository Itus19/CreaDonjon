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
  { _regle?: string; modifiers?: unknown[]; auras?: unknown[]; patches?: unknown[] }
>;

const SRD = JSON.parse(readFileSync(resolve(process.cwd(), "data/srd/srd-2024.json"), "utf-8")) as Record<
  string,
  { index?: string }[]
>;

const entrees = Object.entries(RAW).filter(([k]) => !k.startsWith("_"));

describe("les effets passifs SRD écrits à la main", () => {
  it("chaque bloc produit est un bloc `modifiers` valide, non vide (modificateurs, auras ou retouches, V3.1-171)", () => {
    for (const [key, value] of entrees) {
      const taille = (value.modifiers?.length ?? 0) + (value.auras?.length ?? 0) + (value.patches?.length ?? 0);
      expect(taille, key).toBeGreaterThan(0);
      const bloc = { modifiers: value.modifiers ?? [], ...(value.auras ? { auras: value.auras } : {}), ...(value.patches ? { patches: value.patches } : {}) };
      expect(() => validateBlockData("modifiers", bloc), key).not.toThrow();
    }
  });

  it("V3.1-171 : Résistance naine, Aura de protection à 3 m, Aura étendue à 9 m", () => {
    expect(RAW["dwarven-resilience"].modifiers).toEqual([{ target: "resist.poison", op: "add", value: 1 }]);
    expect(RAW["paladin-aura-of-protection"].auras).toMatchObject([{ radius: 3, affects: "allies", self: false }]);
    expect(RAW["paladin-aura-expansion"].patches).toEqual([{ rule: "paladin-aura-of-protection", field: "aura.radius", value: 9 }]);
  });

  it("chaque clé désigne une VRAIE entrée du SRD 2024", () => {
    const connues = new Set<string>();
    for (const liste of Object.values(SRD)) {
      if (!Array.isArray(liste)) continue;
      for (const e of liste) if (e?.index) connues.add(e.index);
    }
    // V3.1-167 : une aptitude fusionnée entre classes par l'import (« Extra Attack ») se vise par sa clé fusionnée.
    const noms = new Map<string, number>();
    for (const f of (SRD.Features ?? []) as { name?: string }[]) if (f?.name) noms.set(f.name, (noms.get(f.name) ?? 0) + 1);
    for (const [nom, n] of noms) if (n > 1) connues.add(nom.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
    for (const [key] of entrees) expect(connues.has(key), `clé inconnue du SRD : ${key}`).toBe(true);
  });

  it("chaque entrée documente la règle qu'elle traduit", () => {
    for (const [key, value] of entrees) expect(value._regle, key).toBeTruthy();
  });

  it("la Ténacité naine : +1 PV max par niveau", () => {
    expect(RAW["dwarven-toughness"].modifiers).toEqual([{ target: "hp.max", op: "add", value: 1, per_level: true }]);
  });

  it("le Touche-à-tout du barde : la moitié de la maîtrise sur tout jet de caractéristique (V3.1-46)", () => {
    expect(RAW["bard-jack-of-all-trades"].modifiers).toEqual([{ target: "check", op: "half_proficiency" }]);
  });
});
