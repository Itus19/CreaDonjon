import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { zSubclassFeatureEntry } from "../schemas/rule-blocks/blocks";
import type { ChoiceGrant } from "../schemas/rule-blocks/choices";

/**
 * V3.1-117 — `data/srd/subclasses-2024.json` est de la DONNÉE saisie à la
 * main. Une faute de nom d'aptitude arrêterait l'import ; une faute de sort
 * laisserait un terrain sans sort. Ce test le dit avant.
 */

type Authored = Record<string, { _regle?: string; features?: Record<string, { name?: string; modifiers?: unknown[]; spells?: unknown[]; grants?: unknown[] }> }>;
const RAW = JSON.parse(readFileSync(resolve(process.cwd(), "data/srd/subclasses-2024.json"), "utf-8")) as Authored;

function readSrd(file: string) {
  return JSON.parse(readFileSync(resolve(process.cwd(), `data/srd/${file}`), "utf-8")) as Record<string, { index?: string; features?: { name: string; level: number }[] }[]>;
}
const SRD_2024 = readSrd("srd-2024.json");
const SPELLS = new Set([...SRD_2024.Spells, ...readSrd("srd-2014.json").Spells].map((s) => s.index));
const SUBCLASSES = new Map(SRD_2024.Subclasses.map((s) => [s.index, s]));

const entrees = Object.entries(RAW).filter(([k]) => !k.startsWith("_"));

function spellKeys(grants: readonly ChoiceGrant[]): string[] {
  return grants.flatMap((g) => (g.from.kind === "option" ? g.from.options.flatMap((o) => (o.spells ?? []).map((s) => s.key)) : []));
}

describe("la mécanique des sous-classes SRD écrite à la main", () => {
  it("chaque aptitude désigne une VRAIE aptitude d'une vraie sous-classe 2024, et reste valide une fois fusionnée", () => {
    for (const [index, value] of entrees) {
      const sub = SUBCLASSES.get(index);
      expect(sub, `sous-classe inconnue : ${index}`).toBeDefined();
      for (const [prefix, mechanics] of Object.entries(value.features ?? {})) {
        const feature = sub!.features!.find((f) => f.name.startsWith(prefix));
        expect(feature, `${index} : aptitude introuvable « ${prefix} »`).toBeDefined();
        const { name, ...rest } = mechanics;
        const merged = { name: name ?? feature!.name, level: feature!.level, description: "…", ...rest };
        expect(zSubclassFeatureEntry.safeParse(merged).success, `${index} / ${prefix}`).toBe(true);
      }
    }
  });

  it("chaque sort accordé existe dans le SRD importé", () => {
    for (const [index, value] of entrees) {
      for (const mechanics of Object.values(value.features ?? {})) {
        for (const spell of spellKeys((mechanics.grants ?? []) as ChoiceGrant[])) expect(SPELLS.has(spell), `${index} : sort inconnu ${spell}`).toBe(true);
      }
    }
  });

  it("chaque sous-classe documente la règle qu'elle traduit", () => {
    for (const [index, value] of entrees) expect(value._regle, index).toBeTruthy();
  });

  it("Cercle de la Terre, terres arides : Boule de feu au niveau 5 de druide", () => {
    const [land] = RAW["circle-of-the-land"].features!["Circle of the Land Spells"].grants as ChoiceGrant[];
    const arid = land.from.kind === "option" ? land.from.options.find((o) => o.id === "arid") : undefined;
    expect(arid?.spells?.find((s) => s.key === "fireball")?.at_level).toBe(5);
    expect(land.refresh).toBe("long_rest");
  });
});
