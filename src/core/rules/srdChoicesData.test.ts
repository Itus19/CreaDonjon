import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { validateBlockData } from "../schemas/rule-blocks/blocks";
import type { ChoiceGrant } from "../schemas/rule-blocks/choices";

/**
 * V3.1-116 — `data/srd/choices-2024.json` est de la DONNÉE saisie à la main,
 * comme `modifiers-2024.json`. Une faute dans une clé de fiche ou de sort
 * laisserait un lignage sans effet, sans que rien ne le dise.
 */

const RAW = JSON.parse(readFileSync(resolve(process.cwd(), "data/srd/choices-2024.json"), "utf-8")) as Record<
  string,
  { _regle?: string; grants?: unknown[]; presets?: Record<string, string[]> }
>;

function readSrd(file: string): Record<string, { index?: string }[]> {
  return JSON.parse(readFileSync(resolve(process.cwd(), `data/srd/${file}`), "utf-8")) as Record<string, { index?: string }[]>;
}
const SRD_2024 = readSrd("srd-2024.json");
// L'import 2024 complète son fichier par celui de 2014 (sorts compris).
const SPELLS = new Set([...SRD_2024.Spells, ...readSrd("srd-2014.json").Spells].map((s) => s.index));

const entrees = Object.entries(RAW).filter(([k]) => !k.startsWith("_"));

function spellKeys(grants: readonly ChoiceGrant[]): string[] {
  return grants.flatMap((g) =>
    g.from.kind === "option" ? g.from.options.flatMap((o) => [...(o.spells ?? []).map((s) => s.key), ...spellKeys(o.grants ?? [])]) : []
  );
}

describe("les choix SRD écrits à la main", () => {
  it("chaque entrée produit un bloc `choices` valide", () => {
    for (const [key, value] of entrees) {
      expect(() => validateBlockData("choices", { grants: value.grants, ...(value.presets ? { presets: value.presets } : {}) }), key).not.toThrow();
    }
  });

  it("chaque clé désigne une VRAIE entrée du SRD 2024", () => {
    const connues = new Set<string>();
    for (const liste of Object.values(SRD_2024)) {
      if (!Array.isArray(liste)) continue;
      for (const e of liste) if (e?.index) connues.add(e.index);
    }
    for (const [key] of entrees) expect(connues.has(key), `clé inconnue du SRD : ${key}`).toBe(true);
  });

  it("chaque sort accordé existe dans le SRD importé", () => {
    for (const [key, value] of entrees) {
      for (const spell of spellKeys((value.grants ?? []) as ChoiceGrant[])) expect(SPELLS.has(spell), `${key} : sort inconnu ${spell}`).toBe(true);
    }
  });

  it("chaque entrée documente la règle qu'elle traduit", () => {
    for (const [key, value] of entrees) expect(value._regle, key).toBeTruthy();
  });

  it("le Drow apprend Lueurs féeriques au niveau 3 et Ténèbres au niveau 5", () => {
    const [lineage] = RAW["elven-lineage"].grants as ChoiceGrant[];
    const drow = lineage.from.kind === "option" ? lineage.from.options.find((o) => o.id === "drow") : undefined;
    expect(drow?.spells?.map((s) => [s.key, s.at_level ?? 1])).toEqual([
      ["dancing-lights", 1],
      ["faerie-fire", 3],
      ["darkness", 5],
    ]);
  });

  it("l'Acolyte impose la liste du clerc, le Sage celle du magicien", () => {
    expect(RAW.acolyte.presets).toEqual({ "magic-initiate.list": ["cleric"] });
    expect(RAW.sage.presets).toEqual({ "magic-initiate.list": ["wizard"] });
  });

  it("V3.1-49 — Roublard : l'Expertise porte sur des compétences maîtrisées (deux au niveau 1, deux au niveau 6)", () => {
    const grants = RAW["rogue-expertise"].grants as ChoiceGrant[];
    expect(grants.map((g) => [g.id, g.count, g.at_level ?? 1, g.from])).toEqual([
      ["skills", 2, 1, { kind: "skill", expertise: true }],
      ["skills-6", 2, 6, { kind: "skill", expertise: true }],
    ]);
  });

  it("V3.1-49 — Roublard : l'Argot des voleurs est acquis, une langue de plus au choix", () => {
    const grants = RAW["rogue-thieves-cant"].grants as ChoiceGrant[];
    expect(grants.map((g) => [g.id, g.count ?? 1, g.from.kind])).toEqual([
      ["cant", 1, "language"],
      ["language", 1, "language"],
    ]);
    expect(RAW["rogue-thieves-cant"].presets).toEqual({ "rogue-thieves-cant.cant": ["thieves-cant"] });
  });
});

