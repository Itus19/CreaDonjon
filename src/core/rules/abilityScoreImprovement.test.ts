import { describe, expect, it } from "vitest";
import { ASI_FEAT_KEY, asiApplies, asiExceedsCap, asiFeatSources, asiModifiers, isValidAsiChoice, parseAsiChoice, withImplicitAsiFeat } from "./abilityScoreImprovement";
import { resolveChoices } from "./choices";

describe("isValidAsiChoice", () => {
  it("accepte +2 sur une seule caracteristique", () => {
    expect(isValidAsiChoice({ kind: "asi", increases: { str: 2 } })).toBe(true);
  });

  it("accepte +1 sur deux caracteristiques", () => {
    expect(isValidAsiChoice({ kind: "asi", increases: { str: 1, con: 1 } })).toBe(true);
  });

  it("refuse un total different de 2", () => {
    expect(isValidAsiChoice({ kind: "asi", increases: { str: 1 } })).toBe(false);
    expect(isValidAsiChoice({ kind: "asi", increases: { str: 3 } })).toBe(false);
    expect(isValidAsiChoice({ kind: "asi", increases: {} })).toBe(false);
  });

  it("refuse plus de deux caracteristiques touchees", () => {
    expect(isValidAsiChoice({ kind: "asi", increases: { str: 1, dex: 1, con: 1 } })).toBe(false);
  });

  it("refuse une valeur individuelle hors de {1, 2}", () => {
    expect(isValidAsiChoice({ kind: "asi", increases: { str: 0, dex: 2 } })).toBe(false);
  });
});

describe("parseAsiChoice", () => {
  it("reconnait la forme attendue", () => {
    expect(parseAsiChoice({ kind: "asi", increases: { str: 2 } })).toEqual({ kind: "asi", increases: { str: 2 } });
  });

  it("rejette une valeur qui n'est pas un choix d'ASI", () => {
    expect(parseAsiChoice(null)).toBeNull();
    expect(parseAsiChoice({ kind: "skill", chosen: ["arcana"] })).toBeNull();
    expect(parseAsiChoice({ kind: "asi", increases: { str: "deux" } })).toBeNull();
    expect(parseAsiChoice({ kind: "asi", increases: { notAnAbility: 2 } })).toBeNull();
  });
});

describe("asiModifiers", () => {
  it("produit un modificateur additif couche 5 par caracteristique touchee", () => {
    const modifiers = asiModifiers({ kind: "asi", increases: { str: 1, con: 1 } }, "asi:fighter.l4", "ASI (Guerrier niv. 4)");
    expect(modifiers).toEqual(
      expect.arrayContaining([
        { target: "ability.str", op: "add", value: 1, layer: 5, source: "asi:fighter.l4", label: "ASI (Guerrier niv. 4)" },
        { target: "ability.con", op: "add", value: 1, layer: 5, source: "asi:fighter.l4", label: "ASI (Guerrier niv. 4)" },
      ])
    );
    expect(modifiers).toHaveLength(2);
  });
});

describe("asiExceedsCap (plafond du ruleset, V3.1-115)", () => {
  const avant = { str: 19, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  it("+2 sur 19 dépasse le plafond 20, +1 non", () => {
    expect(asiExceedsCap({ kind: "asi", increases: { str: 2 } }, avant, 20)).toBe(true);
    expect(asiExceedsCap({ kind: "asi", increases: { str: 1, dex: 1 } }, avant, 20)).toBe(false);
  });
  it("lit le plafond du ruleset : au plafond 15, 14 + 2 dépasse", () => {
    expect(asiExceedsCap({ kind: "asi", increases: { dex: 2 } }, { ...avant, dex: 14 }, 15)).toBe(true);
    expect(asiExceedsCap({ kind: "asi", increases: { dex: 2 } }, { ...avant, dex: 13 }, 15)).toBe(false);
  });
  it("une caractéristique déjà au-dessus du plafond ne peut plus monter", () => {
    expect(asiExceedsCap({ kind: "asi", increases: { str: 1, dex: 1 } }, { ...avant, str: 21 }, 20)).toBe(true);
  });
});

describe("l'amélioration de caractéristique ou un don général (V3.1-118, règle 2024)", () => {
  const sources = asiFeatSources({ fighter: [4, 8] }, { fighter: "Guerrier" });
  const feats = {
    [ASI_FEAT_KEY]: { key: ASI_FEAT_KEY, label: "Amélioration de caractéristique", category: "general", grants: [], modifiers: [] },
    grappler: { key: "grappler", label: "Lutteur", category: "general", grants: [], modifiers: [] },
    alert: { key: "alert", label: "Vigilant", category: "origin", grants: [], modifiers: [] },
  };

  it("chaque niveau d'amélioration ouvre un choix de don général, rangé sous la classe, au niveau de CETTE classe", () => {
    expect(sources.map((s) => s.key)).toEqual(["fighter.l4", "fighter.l8"]);
    expect(sources[0]).toMatchObject({ origin: "class", classKey: "fighter", layer: 5 });
    const auNiveau4 = resolveChoices({ sources, choices: {}, characterLevel: 4, classLevels: { fighter: 4 }, feats });
    expect(auNiveau4.open.map((o) => o.key)).toEqual(["fighter.l4.feat"]);
    expect(auNiveau4.open[0]!.from).toEqual({ kind: "feat", category: "general" });
    // Un don d'une autre catégorie est refusé ; un don général choisi produit son aptitude.
    expect(resolveChoices({ sources, choices: { "fighter.l4.feat": ["alert"] }, characterLevel: 4, classLevels: { fighter: 4 }, feats }).open[0]!.chosen).toEqual([]);
    const lutteur = resolveChoices({ sources, choices: { "fighter.l4.feat": ["grappler"] }, characterLevel: 4, classLevels: { fighter: 4 }, feats });
    expect(lutteur.features.map((f) => f.label)).toContain("Lutteur");
    expect(resolveChoices({ sources, choices: {}, characterLevel: 3, classLevels: { fighter: 3 }, feats }).open).toEqual([]);
  });

  it("le +2/+1+1 ne s'applique que si le don choisi est l'amélioration (ou si aucun don n'est encore choisi : personnage d'avant)", () => {
    expect(asiApplies({}, "fighter.l4.asi")).toBe(true);
    expect(asiApplies({ "fighter.l4.feat": [ASI_FEAT_KEY] }, "fighter.l4.asi")).toBe(true);
    expect(asiApplies({ "fighter.l4.feat": ["grappler"] }, "fighter.l4.asi")).toBe(false);
  });

  it("un personnage d'avant, avec son +2 déjà posé, a choisi l'amélioration sans rien refaire", () => {
    const avant = { "fighter.l4.asi": { kind: "asi", increases: { str: 2 } } };
    expect(withImplicitAsiFeat(avant)).toEqual({ ...avant, "fighter.l4.feat": [ASI_FEAT_KEY] });
    const choisi = { "fighter.l4.asi": { kind: "asi", increases: { str: 2 } }, "fighter.l4.feat": ["grappler"] };
    expect(withImplicitAsiFeat(choisi)).toBe(choisi);
    const resolu = resolveChoices({ sources, choices: withImplicitAsiFeat(avant), characterLevel: 4, classLevels: { fighter: 4 }, feats });
    expect(resolu.open[0]!.chosen).toEqual([ASI_FEAT_KEY]);
  });
});
