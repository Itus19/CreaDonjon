import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { zClassBasicsBlockData } from "../schemas/rule-blocks/blocks";

/** V3.1-113 — `data/srd/class-spellcasting.json` est de la DONNÉE saisie à la main : une classe mal nommée ne compterait plus dans le multiclassé, sans le dire. */
const RAW = JSON.parse(readFileSync(resolve(process.cwd(), "data/srd/class-spellcasting.json"), "utf-8")) as Record<string, Record<string, Record<string, unknown>>>;

function classIndexes(file: string): Set<string> {
  const srd = JSON.parse(readFileSync(resolve(process.cwd(), `data/srd/${file}`), "utf-8")) as { Classes: { index: string }[] };
  return new Set(srd.Classes.map((c) => c.index));
}

describe("l'incantation des classes SRD écrite à la main", () => {
  for (const [system, file] of [["dnd_srd_52", "srd-2024.json"], ["dnd_srd_51", "srd-2014.json"]] as const) {
    it(`${system} : chaque clé est une vraie classe, chaque entrée un fragment valide de class_basics`, () => {
      const known = classIndexes(file);
      for (const [key, value] of Object.entries(RAW[system])) {
        expect(known.has(key), `classe inconnue : ${key}`).toBe(true);
        expect(zClassBasicsBlockData.pick({ spellcasting_kind: true, caster_weight: true }).strict().safeParse(value).success, key).toBe(true);
      }
    });
  }

  it("2024 arrondit la moitié des niveaux de paladin au supérieur, 2014 à l'inférieur", () => {
    expect(RAW.dnd_srd_52.paladin).toEqual({ caster_weight: { fraction: "half", rounding: "up" } });
    expect(RAW.dnd_srd_51.paladin).toEqual({ caster_weight: { fraction: "half", rounding: "down" } });
  });

  it("l'occultiste a une réserve de pacte et ne compte pas dans la table", () => {
    expect(RAW.dnd_srd_52.warlock).toEqual({ spellcasting_kind: "pact" });
  });
});
