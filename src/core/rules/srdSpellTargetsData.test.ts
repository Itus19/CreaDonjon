import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { zEffectData } from "../schemas/rule-blocks/blocks";

/**
 * V3.1-110 — `data/srd/spell-targets.json` est de la DONNÉE relevée à la main
 * dans le texte du SRD. Une faute de clé laisserait un sort sans restriction
 * (l'import l'arrête aussi) ; une majuscule ferait échouer la comparaison.
 */
type Restrictions = Record<string, { creature_types?: string[]; exclude_creature_types?: string[]; immune_conditions_block?: string[] }>;
const RAW = JSON.parse(readFileSync(resolve(process.cwd(), "data/srd/spell-targets.json"), "utf-8")) as Record<string, Restrictions | string>;

function spellKeys(file: string): Set<string> {
  const data = JSON.parse(readFileSync(resolve(process.cwd(), `data/srd/${file}`), "utf-8")) as { Spells: { index: string }[] };
  return new Set(data.Spells.map((s) => s.index));
}
const SPELLS_2014 = spellKeys("srd-2014.json");
const SPELLS_2024 = new Set([...SPELLS_2014, ...spellKeys("srd-2024.json")]);

describe("la restriction de cible des sorts SRD écrite à la main", () => {
  it("documente sa règle et ne connaît que les deux éditions", () => {
    expect(RAW._regle).toBeTruthy();
    expect(Object.keys(RAW).filter((k) => !k.startsWith("_")).sort()).toEqual(["dnd_srd_51", "dnd_srd_52"]);
  });

  for (const [edition, spells] of [["dnd_srd_51", SPELLS_2014], ["dnd_srd_52", SPELLS_2024]] as const) {
    it(`${edition} : chaque sort existe, chaque restriction est valide et en minuscules`, () => {
      for (const [key, target] of Object.entries(RAW[edition] as Restrictions)) {
        expect(spells.has(key), `${edition} : sort inconnu ${key}`).toBe(true);
        expect(zEffectData.safeParse({ id: "e1", target }).success, `${edition} / ${key}`).toBe(true);
        for (const value of [...(target.creature_types ?? []), ...(target.exclude_creature_types ?? []), ...(target.immune_conditions_block ?? [])]) {
          expect(value, `${edition} / ${key}`).toBe(value.toLowerCase());
        }
      }
    });
  }

  it("Charme-personne vise un humanoïde dans les deux éditions", () => {
    for (const edition of ["dnd_srd_51", "dnd_srd_52"]) {
      expect((RAW[edition] as Restrictions)["charm-person"]).toEqual({ creature_types: ["humanoid"], immune_conditions_block: ["charmed"] });
    }
  });
});
