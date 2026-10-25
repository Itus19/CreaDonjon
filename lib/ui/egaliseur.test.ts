import { describe, expect, it } from "vitest";
import { colonnesEgaliseur, SEUIL_COMPTEUR, type EntreeEgaliseur } from "./egaliseur";

function entree(partiel: Partial<EntreeEgaliseur> = {}): EntreeEgaliseur {
  return { slots: {}, slotsUsed: {}, pact: null, pactUsed: 0, trackers: [], resourcesUsed: {}, classKeys: [], ...partiel };
}

describe("colonnesEgaliseur", () => {
  it("rien à compter : aucun groupe", () => {
    expect(colonnesEgaliseur(entree())).toEqual([]);
  });

  it("emplacements par niveau croissant, sans niveau vide ; recharge au repos long", () => {
    const groupes = colonnesEgaliseur(entree({ slots: { 2: 2, 1: 4, 3: 0 }, slotsUsed: { "1": 1 } }));
    expect(groupes).toHaveLength(1);
    expect(groupes[0]!.cle).toBe("emplacements");
    expect(groupes[0]!.colonnes.map((c) => [c.niveau, c.total, c.restants, c.recharge, c.genre])).toEqual([
      [1, 4, 3, "long_rest", "emplacement"],
      [2, 2, 2, "long_rest", "emplacement"],
    ]);
    expect(groupes[0]!.colonnes[0]!.geste).toEqual({ pool: "slots", level: 1 });
  });

  it("occultiste : la réserve de pacte à part, après les emplacements, rendue au repos court", () => {
    const groupes = colonnesEgaliseur(entree({ slots: { 1: 2 }, pact: { count: 4, slotLevel: 5 }, pactUsed: 1 }));
    const colonnes = groupes[0]!.colonnes;
    expect(colonnes.map((c) => c.genre)).toEqual(["emplacement", "pacte"]);
    expect(colonnes[1]).toMatchObject({ niveau: 5, total: 4, restants: 3, recharge: "short_rest", geste: { pool: "pact" } });
  });

  it("un dépassement ne donne jamais de restants négatifs", () => {
    const colonnes = colonnesEgaliseur(entree({ slots: { 1: 2 }, slotsUsed: { "1": 5 } }))[0]!.colonnes;
    expect(colonnes[0]!.restants).toBe(0);
  });

  it("ressources : classe si la source est une classe du personnage, traits sinon ; ordre des groupes fixe", () => {
    const groupes = colonnesEgaliseur(
      entree({
        slots: { 1: 2 },
        classKeys: ["barbarian", "path-of-the-berserker"],
        trackers: [
          { id: "chance", label: "Chanceux", max: 3, recharge: "long_rest", sourceKey: "lucky" },
          { id: "rage", label: "Rage", max: 3, recharge: "short_rest_one", sourceKey: "barbarian" },
          { id: "jauge", label: "Baguette", max: 7, recharge: "dawn", sourceKey: null },
        ],
        resourcesUsed: { rage: 1 },
      })
    );
    expect(groupes.map((g) => g.cle)).toEqual(["emplacements", "classe", "traits"]);
    expect(groupes[1]!.colonnes[0]).toMatchObject({ libelle: "Rage", total: 3, restants: 2, recharge: "short_rest_one", genre: "classe", geste: { tracker: "rage" } });
    expect(groupes[2]!.colonnes.map((c) => c.libelle)).toEqual(["Chanceux", "Baguette"]);
  });

  it("au-delà de six utilisations, un compteur ; jusqu'à six, des pastilles", () => {
    const colonnes = colonnesEgaliseur(
      entree({
        trackers: [
          { id: "six", label: "Six", max: SEUIL_COMPTEUR, recharge: "long_rest", sourceKey: null },
          { id: "sept", label: "Sept", max: SEUIL_COMPTEUR + 1, recharge: "long_rest", sourceKey: null },
        ],
      })
    )[0]!.colonnes;
    expect(colonnes.map((c) => c.forme)).toEqual(["pastilles", "compteur"]);
  });

  it("une ressource sans maximum n'apparaît pas", () => {
    expect(colonnesEgaliseur(entree({ trackers: [{ id: "x", label: "X", max: 0, recharge: "long_rest", sourceKey: null }] }))).toEqual([]);
  });
});
