import { describe, expect, it } from "vitest";
import { aSecourir, butDeCombat, declencheursDeMoral, espritDeCombat, jetDeSecours, modificateurDeMoral, testDeMoral, type PsycheAuCombat } from "./combatMinds";

const base = (p: Partial<PsycheAuCombat> & { id: string }): PsycheAuCombat => ({
  archetype: null,
  camp: "defenseur",
  agresseurId: "pj",
  cibleId: "mabelle",
  envers: {},
  poles: {},
  convictions: {},
  aspirationsDeVie: 0,
  ...p,
});

/** Un dé truqué : rend les faces données, dans l'ordre (1 à 20). */
const des = (...faces: number[]) => ({ nextInt: () => (faces.shift() ?? 10) - 1 });

describe("butDeCombat (ADR 0122, point 1)", () => {
  it("la garde veut arrêter l'agresseur", () => {
    expect(butDeCombat(base({ id: "g", archetype: "garde" }))).toEqual({ but: "arreter", protege: null });
  });

  it("le malfrat, ou un égoïste qui préfère la richesse à l'honneur, veut piller", () => {
    expect(butDeCombat(base({ id: "m", archetype: "malfrat" })).but).toBe("piller");
    expect(butDeCombat(base({ id: "e", poles: { altruism_selfishness: -50 }, convictions: { wealth_honor: 40 } })).but).toBe("piller");
  });

  it("celui qui entre pour un ami le défend : la cible côté défense, l'agresseur côté attaque", () => {
    expect(butDeCombat(base({ id: "ami" }))).toEqual({ but: "defendre", protege: "mabelle" });
    expect(butDeCombat(base({ id: "complice", camp: "agresseur" }))).toEqual({ but: "defendre", protege: "pj" });
  });

  it("la cible qui craint son agresseur ou tient à la paix veut survivre ; sinon elle veut vaincre", () => {
    expect(butDeCombat(base({ id: "mabelle", envers: { pj: { peur: 40 } } })).but).toBe("survivre");
    expect(butDeCombat(base({ id: "mabelle", convictions: { peace_force: 50 } })).but).toBe("survivre");
    expect(butDeCombat(base({ id: "mabelle" }))).toEqual({ but: "vaincre", protege: null });
  });

  it("la garde reste la garde, même prise pour cible", () => {
    expect(butDeCombat(base({ id: "mabelle", archetype: "garde", envers: { pj: { peur: 80 } } })).but).toBe("arreter");
  });
});

describe("modificateurDeMoral (ADR 0122, point 2)", () => {
  it("neutre sans psyché, pour qui veut vaincre", () => {
    expect(modificateurDeMoral(base({ id: "x" }), "vaincre")).toBe(0);
  });

  it("la peur de l'adversaire l'abaisse, l'assurance le monte", () => {
    expect(modificateurDeMoral(base({ id: "x", envers: { pj: { peur: 60 } } }), "vaincre")).toBe(-3);
    expect(modificateurDeMoral(base({ id: "x", envers: { pj: { peur: -60 } } }), "vaincre")).toBe(3);
  });

  it("un camp agresseur craint la cible, pas lui-même", () => {
    expect(modificateurDeMoral(base({ id: "x", camp: "agresseur", envers: { mabelle: { peur: 60 }, pj: { peur: -100 } } }), "vaincre")).toBe(-3);
  });

  it("l'impulsivité tient, les aspirations d'une vie font lâcher, l'archétype et le but comptent", () => {
    expect(modificateurDeMoral(base({ id: "x", poles: { impulse_prudence: 100 } }), "vaincre")).toBe(2);
    expect(modificateurDeMoral(base({ id: "x", aspirationsDeVie: 6 }), "vaincre")).toBe(-2);
    expect(modificateurDeMoral(base({ id: "x", archetype: "garde" }), "arreter")).toBe(4);
    expect(modificateurDeMoral(base({ id: "x", archetype: "malfrat" }), "piller")).toBe(-3);
    expect(modificateurDeMoral(base({ id: "x" }), "survivre")).toBe(-4);
  });

  it("borné à ± 6", () => {
    expect(modificateurDeMoral(base({ id: "x", envers: { pj: { peur: 100 } }, aspirationsDeVie: 9 }), "survivre")).toBe(-6);
    expect(modificateurDeMoral(base({ id: "x", archetype: "garde", envers: { pj: { peur: -100 } }, poles: { impulse_prudence: 100 } }), "arreter")).toBe(6);
  });
});

describe("espritDeCombat", () => {
  it("rassemble but, protégé et modificateur, prêt à se battre", () => {
    expect(espritDeCombat(base({ id: "g", archetype: "garde" }))).toEqual({ but: "arreter", protege: null, mod: 4, etat: "combat", testes: [] });
  });
});

describe("declencheursDeMoral (ADR 0122, point 3)", () => {
  const sit = { pv: 9, pvMax: 9, alliesTombes: [] as string[], alliesDebout: 1, ennemisDebout: 1, testes: [] as string[] };

  it("rien tant qu'il est en forme, entouré, sans allié tombé", () => {
    expect(declencheursDeMoral(sit)).toEqual([]);
  });

  it("à la moitié de ses PV, DD 10, une seule fois", () => {
    expect(declencheursDeMoral({ ...sit, pv: 4 })).toEqual([{ cle: "moitie", dd: 10 }]);
    expect(declencheursDeMoral({ ...sit, pv: 4, testes: ["moitie"] })).toEqual([]);
  });

  it("un allié tombé, DD 10 ; seul contre plusieurs, DD 12", () => {
    expect(declencheursDeMoral({ ...sit, alliesTombes: ["a1"] })).toEqual([{ cle: "allie:a1", dd: 10 }]);
    expect(declencheursDeMoral({ ...sit, alliesDebout: 0, ennemisDebout: 2 })).toEqual([{ cle: "seul", dd: 12 }]);
    expect(declencheursDeMoral({ ...sit, alliesDebout: 0, ennemisDebout: 1 })).toEqual([]);
  });
});

describe("testDeMoral (ADR 0122, point 3)", () => {
  const esprit = { ...espritDeCombat(base({ id: "x" })), mod: 0 };
  const sit = { engage: true, pv: 4, pvMax: 9 };

  it("sans déclencheur, pas de jet", () => {
    expect(testDeMoral(esprit, [], sit, des(1))).toEqual({ esprit, jet: null });
  });

  it("réussi : il tient bon, et le déclencheur est noté", () => {
    const r = testDeMoral(esprit, [{ cle: "moitie", dd: 10 }], sit, des(12));
    expect(r.esprit).toMatchObject({ etat: "combat", testes: ["moitie"] });
    expect(r.jet).toEqual({ naturel: 12, total: 12, dd: 10, tient: true });
  });

  it("raté : il fuit ; au contact et à un quart de ses PV, il se rend", () => {
    expect(testDeMoral(esprit, [{ cle: "moitie", dd: 10 }], sit, des(5)).esprit.etat).toBe("fuite");
    expect(testDeMoral(esprit, [{ cle: "moitie", dd: 10 }], { ...sit, pv: 2 }, des(5)).esprit.etat).toBe("rendu");
    expect(testDeMoral(esprit, [{ cle: "moitie", dd: 10 }], { ...sit, pv: 2, engage: false }, des(5)).esprit.etat).toBe("fuite");
  });

  it("un seul jet contre le plus haut DD, tous les déclencheurs notés", () => {
    const r = testDeMoral(esprit, [{ cle: "moitie", dd: 10 }, { cle: "seul", dd: 12 }], sit, des(11));
    expect(r.jet).toMatchObject({ dd: 12, tient: false });
    expect(r.esprit.testes).toEqual(["moitie", "seul"]);
  });

  it("le modificateur compte ; un 20 tient toujours, un 1 lâche toujours", () => {
    const brave = { ...esprit, mod: 6 };
    const lache = { ...esprit, mod: -6 };
    expect(testDeMoral(brave, [{ cle: "seul", dd: 12 }], sit, des(6)).jet?.tient).toBe(true);
    expect(testDeMoral(lache, [{ cle: "moitie", dd: 10 }], sit, des(20)).jet?.tient).toBe(true);
    expect(testDeMoral(brave, [{ cle: "moitie", dd: 10 }], sit, des(1)).jet?.tient).toBe(false);
  });
});

describe("aSecourir et jetDeSecours (le personnage à terre)", () => {
  it("celui qui défend un allié mourant vient le stabiliser, s'il n'est pas loin", () => {
    expect(aSecourir({ but: "defendre", protege: "pj" }, ["pj"], "near")).toBe("pj");
    expect(aSecourir({ but: "defendre", protege: "pj" }, ["pj"], "far")).toBeNull();
    expect(aSecourir({ but: "defendre", protege: "pj" }, [], "engaged")).toBeNull();
    expect(aSecourir({ but: "vaincre", protege: null }, ["pj"], "engaged")).toBeNull();
    expect(aSecourir(undefined, ["pj"], "engaged")).toBeNull();
  });

  it("Sagesse (Médecine) DD 10", () => {
    expect(jetDeSecours(2, des(8))).toEqual({ naturel: 8, total: 10, reussi: true });
    expect(jetDeSecours(0, des(9))).toEqual({ naturel: 9, total: 9, reussi: false });
  });
});
