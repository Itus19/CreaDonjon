import { describe, expect, it } from "vitest";
import { COVERAGE_BRICKS, coverageCategoryOf, coverageOf, coverageTally, type CoverageResult } from "./coverage";
import { zCoverageBlockData } from "../schemas/rule-blocks/playable";

/**
 * V3.1-212 (ADR 0100) — ce que « jouable » veut dire, catégorie par catégorie.
 */
describe("coverageCategoryOf", () => {
  it("range chaque type de fiche, et met hors du compte ce qui n'a rien à jouer", () => {
    expect(coverageCategoryOf("feature")).toBe("feature");
    expect(coverageCategoryOf("spell")).toBe("spell");
    expect(coverageCategoryOf("species")).toBe("species");
    expect(coverageCategoryOf("monster")).toBe("monster");
    expect(coverageCategoryOf("condition")).toBe("condition");
    for (const t of ["background", "mount", "rule", "item", "inconnu"]) expect(coverageCategoryOf(t)).toBe("out_of_scope");
  });
});

describe("coverageOf : le critère du bloc mécanique", () => {
  it("un sort à bloc d'effets est jouable sans activation", () => {
    expect(coverageOf({ category: "spell", blockTypes: ["description", "effects"], gaps: [] })).toEqual({ state: "playable", gaps: [] });
  });

  it("une arme à bloc weapon est jouable ; une aptitude sans bloc mécanique n'est pas évaluée", () => {
    expect(coverageOf({ category: "weapon", blockTypes: ["weapon"], gaps: [] }).state).toBe("playable");
    expect(coverageOf({ category: "feature", blockTypes: ["description"], gaps: [] }).state).toBe("unevaluated");
  });

  it("des lacunes rendent partielle ; une lacune sans brique compte dans other, une brique inconnue aussi", () => {
    const r = coverageOf({
      category: "feature",
      blockTypes: ["activation", "coverage"],
      gaps: [{ text: "au jet d'Initiative", missing: "…", brick: "timing" }, { text: "sans brique", missing: "…" }, { text: "brique fausse", missing: "…", brick: "inventee" }],
    });
    expect(r.state).toBe("partial");
    expect(r.gaps.map((g) => g.brick)).toEqual(["timing", "other", "other"]);
  });
});

describe("coverageOf : espèce, classe, sous-classe par leurs aptitudes", () => {
  const jouable: CoverageResult = { state: "playable", gaps: [] };
  const partielle: CoverageResult = { state: "partial", gaps: [{ brick: "choice", text: "forme connue", rule: "druid-wild-shape" }] };
  const brute: CoverageResult = { state: "unevaluated", gaps: [] };

  it("toutes ses aptitudes jouables : jouable ; une partielle : partielle, avec ses lacunes", () => {
    expect(coverageOf({ category: "species", parts: [jouable, jouable] }).state).toBe("playable");
    const r = coverageOf({ category: "subclass", parts: [jouable, partielle] });
    expect(r).toEqual({ state: "partial", gaps: partielle.gaps });
  });

  it("une aptitude non évaluée parmi des jouables : partielle ; toutes non évaluées, ou aucune : non évaluée", () => {
    expect(coverageOf({ category: "species", parts: [jouable, brute] }).state).toBe("partial");
    expect(coverageOf({ category: "species", parts: [brute, brute] }).state).toBe("unevaluated");
    expect(coverageOf({ category: "species", parts: [] }).state).toBe("unevaluated");
  });
});

describe("coverageOf : un monstre par ses actions et ses traits", () => {
  it("des actions chiffrées et aucun trait : jouable", () => {
    expect(coverageOf({ category: "monster", actions: [{ name: "Morsure", attack: true, damage: true }], traits: [] }).state).toBe("playable");
  });

  it("une action sans jet ni dégâts, ou un trait en prose : partiel, avec la brique de chacun", () => {
    const r = coverageOf({
      category: "monster",
      actions: [{ name: "Morsure", attack: true, damage: true }, { name: "Cri terrifiant", attack: false, damage: false }],
      traits: [{ name: "Odorat aiguisé" }],
    });
    expect(r.state).toBe("partial");
    expect(r.gaps).toEqual([
      { brick: "monster_action", text: "Cri terrifiant" },
      { brick: "monster_trait", text: "Odorat aiguisé" },
    ]);
  });

  it("une action de dégâts sans jet d'attaque (un souffle) est chiffrée", () => {
    expect(coverageOf({ category: "monster", actions: [{ name: "Souffle", attack: false, damage: true }], traits: [] }).state).toBe("playable");
  });
});

describe("coverageOf : un état par le moteur", () => {
  it("un état que le moteur joue est jouable ; les autres ne sont pas évalués", () => {
    expect(coverageOf({ category: "condition", key: "blinded" }).state).toBe("playable");
    expect(coverageOf({ category: "condition", key: "invisible" }).state).toBe("playable");
    expect(coverageOf({ category: "condition", key: "petrified" }).state).toBe("unevaluated");
  });
});

describe("coverageOf : hors du compte", () => {
  it("un historique ou une règle générale ne compte pas", () => {
    expect(coverageOf({ category: "out_of_scope" })).toEqual({ state: "out_of_scope", gaps: [] });
  });
});

describe("coverageTally", () => {
  it("compte par état, et les lacunes par brique, sans compter ce qui est hors du compte", () => {
    const t = coverageTally([
      { state: "playable", gaps: [] },
      { state: "partial", gaps: [{ brick: "timing", text: "a" }, { brick: "timing", text: "b" }, { brick: "choice", text: "c" }] },
      { state: "unevaluated", gaps: [] },
      { state: "out_of_scope", gaps: [] },
    ]);
    expect(t).toEqual({ playable: 1, partial: 1, unevaluated: 1, total: 3, byBrick: { timing: 2, choice: 1 } });
  });
});

describe("le schéma du bloc coverage", () => {
  it("accepte une brique du vocabulaire, refuse une brique inconnue, reste valide sans brique", () => {
    expect(zCoverageBlockData.safeParse({ gaps: [{ text: "a", missing: "b", brick: "timing" }] }).success).toBe(true);
    expect(zCoverageBlockData.safeParse({ gaps: [{ text: "a", missing: "b" }] }).success).toBe(true);
    expect(zCoverageBlockData.safeParse({ gaps: [{ text: "a", missing: "b", brick: "inventee" }] }).success).toBe(false);
    expect(COVERAGE_BRICKS).toContain("other");
  });
});
