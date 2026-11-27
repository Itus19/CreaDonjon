import { describe, expect, it } from "vitest";
import { azgaarFileToWorldExport, historyYears } from "./toWorldExport";
import { petiteCarte } from "./petiteCarte";
import { zWorldExport } from "../../schemas/worldExport";

describe("azgaarFileToWorldExport", () => {
  it("lit la carte, simule l'histoire et rend un monde importable avec son résumé", () => {
    const { data, summary } = azgaarFileToWorldExport(petiteCarte());
    expect(() => zWorldExport.parse(data)).not.toThrow();
    expect(data.world.name).toBe("Essai");
    expect(summary).toMatchObject({ name: "Essai", sites: 3, notables: 2, states: 2, presentYear: 355 });
    expect(summary.events).toBeGreaterThan(0);
  });

  it("donne le même monde pour la même carte", () => {
    expect(azgaarFileToWorldExport(petiteCarte())).toEqual(azgaarFileToWorldExport(petiteCarte()));
  });

  it("nomme le monde « Monde Azgaar » quand la carte n'a pas de nom", () => {
    const carte = petiteCarte();
    delete (carte.info as { mapName?: string }).mapName;
    expect(azgaarFileToWorldExport(carte).data.world.name).toBe("Monde Azgaar");
  });

  it("refuse un fichier qui n'est pas une carte Azgaar, avec un message lisible", () => {
    expect(() => azgaarFileToWorldExport({ formatVersion: 1 })).toThrow(/carte Azgaar/);
  });
});

describe("historyYears", () => {
  it("simule 300 ans par défaut, et remonte assez loin pour garder la plus vieille guerre", () => {
    expect(historyYears(354, [])).toBe(300);
    expect(historyYears(354, [194])).toBe(300);
    expect(historyYears(1000, [100])).toBe(920);
    expect(historyYears(5000, [0])).toBe(2000);
  });
});
