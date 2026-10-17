import { describe, expect, it } from "vitest";
import type { AdvantagePair } from "@/src/core/dice/diceTool";
import {
  ajouterDe,
  avantageEffectif,
  bandeRelanceVisible,
  carresAttendus,
  carresDuJet,
  cheminAction,
  corpsAction,
  ddDepuisSaisie,
  emplacementsAttendus,
  estSecret,
  lireDiffusionDd,
  etatDe,
  facesAttendues,
  formaterModificateur,
  fusionnerJets,
  lireDcPrive,
  pasDd,
  pasModificateur,
  peutLancer,
  preReglageDepuisFiche,
  reserveDepuis,
  reserveLibre,
  reserveVide,
  testARelancer,
  titreOutil,
  type JetAffiche,
} from "./outilDes";

describe("réserve", () => {
  it("le jet libre est un d20 sans rien d'autre", () => {
    expect(reserveLibre()).toEqual({ d4: 0, d6: 0, d8: 0, d10: 0, d12: 0, d20: 1, d100: 0 });
  });

  it("toucher un dé ajoute 1, jusqu'au plafond de la route", () => {
    let reserve = reserveVide();
    reserve = ajouterDe(reserve, "d6");
    reserve = ajouterDe(reserve, "d6");
    expect(reserve.d6).toBe(2);
    for (let i = 0; i < 30; i++) reserve = ajouterDe(reserve, "d6");
    expect(reserve.d6).toBe(20);
  });

  it("un préréglage partiel complète les types absents par zéro", () => {
    expect(reserveDepuis({ d8: 2 })).toEqual({ ...reserveVide(), d8: 2 });
  });

  it("une réserve vide ne se lance pas", () => {
    expect(peutLancer(reserveVide())).toBe(false);
    expect(peutLancer(reserveLibre())).toBe(true);
  });
});

describe("carrés attendus avant le lancer", () => {
  it("un carré par dé", () => {
    expect(carresAttendus({ ...reserveVide(), d6: 2, d20: 1 }, "normal")).toBe(3);
  });

  it("deux carrés pour un d20 avec avantage ou désavantage", () => {
    expect(carresAttendus(reserveLibre(), "advantage")).toBe(2);
    expect(carresAttendus(reserveLibre(), "disadvantage")).toBe(2);
    expect(facesAttendues({ ...reserveVide(), d20: 1, d6: 1 }, "advantage")).toEqual([6, 20, 20]);
  });

  it("l'avantage retombe à normal sans un d20 exactement", () => {
    expect(avantageEffectif({ ...reserveVide(), d6: 1 }, "advantage")).toBe("normal");
    expect(avantageEffectif({ ...reserveVide(), d20: 2 }, "advantage")).toBe("normal");
    expect(carresAttendus({ ...reserveVide(), d20: 2 }, "advantage")).toBe(2);
  });
});

describe("emplacements attendus", () => {
  it("la paire d'avantage tient un seul emplacement, étiqueté", () => {
    expect(emplacementsAttendus({ ...reserveVide(), d20: 1, d6: 2 }, "disadvantage")).toEqual([
      { type: "de", faces: 6 },
      { type: "de", faces: 6 },
      { type: "paire", mode: "disadvantage" },
    ]);
    expect(emplacementsAttendus(reserveLibre(), "normal")).toEqual([{ type: "de", faces: 20 }]);
  });
});

describe("diffusion du DD", () => {
  it("lit une valeur ou un DD privé", () => {
    expect(lireDiffusionDd({ dc: 13, private: false })).toEqual({ dc: 13, prive: false });
    expect(lireDiffusionDd({ dc: null, private: true })).toEqual({ dc: null, prive: true });
    expect(lireDiffusionDd({ dc: "13" })).toEqual({ dc: null, prive: false });
    expect(lireDiffusionDd(undefined)).toEqual({ dc: null, prive: false });
  });
});

describe("titre", () => {
  it("le nom du bouton touché, ou Jet libre", () => {
    expect(titreOutil("Dague — touche", "Jet libre")).toBe("Dague — touche");
    expect(titreOutil(null, "Jet libre")).toBe("Jet libre");
    expect(titreOutil("  ", "Jet libre")).toBe("Jet libre");
  });
});

describe("modificateur et DD", () => {
  it("borne le modificateur à ±99", () => {
    expect(pasModificateur(99, 1)).toBe(99);
    expect(pasModificateur(-99, -1)).toBe(-99);
    expect(pasModificateur(2, -1)).toBe(1);
    expect(formaterModificateur(3)).toBe("+3");
    expect(formaterModificateur(0)).toBe("0");
    expect(formaterModificateur(-2)).toBe("-2");
  });

  it("un DD vide part de 10 ; les bornes sont 1 et 50", () => {
    expect(pasDd(null, 1)).toBe(10);
    expect(pasDd(null, -1)).toBe(10);
    expect(pasDd(1, -1)).toBe(1);
    expect(pasDd(50, 1)).toBe(50);
    expect(pasDd(13, 1)).toBe(14);
  });

  it("la saisie du DD : chiffres, vide ou zéro = pas de DD", () => {
    expect(ddDepuisSaisie("")).toBeNull();
    expect(ddDepuisSaisie("0")).toBeNull();
    expect(ddDepuisSaisie("1a3")).toBe(13);
    expect(ddDepuisSaisie("99")).toBe(50);
    expect(ddDepuisSaisie("123")).toBe(12);
  });
});

describe("actions de la fiche", () => {
  it("choisit la bonne route et le bon corps", () => {
    expect(cheminAction({ kind: "ability", entityId: "e", ability: "str" })).toBe("ability-check");
    expect(cheminAction({ kind: "skill", entityId: "e", skill: "stealth" })).toBe("skill-check");
    expect(cheminAction({ kind: "save", entityId: "e", ability: "wis" })).toBe("saving-throw");
    expect(cheminAction({ kind: "initiative", entityId: "e" })).toBe("initiative-check");
    expect(corpsAction({ kind: "save", entityId: "e", ability: "wis" })).toEqual({ ability: "wis" });
    expect(corpsAction({ kind: "skill", entityId: "e", skill: "stealth" })).toEqual({ skill: "stealth" });
    expect(corpsAction({ kind: "initiative", entityId: "e" })).toEqual({});
  });

  it("le préréglage d'un test est un d20 verrouillé sur l'action", () => {
    const action = { kind: "skill", entityId: "e", skill: "stealth" } as const;
    const p = preReglageDepuisFiche(action, "advantage", { label: "Discrétion — test", modifier: 5, inspiration: 1 });
    expect(p).toMatchObject({ label: "Discrétion — test", dice: { d20: 1 }, modifier: 5, advantage: "advantage", action, inspiration: 1 });
  });

  it("convertit l'action en test à relancer, sauf l'initiative", () => {
    expect(testARelancer({ kind: "skill", entityId: "e", skill: "stealth" })).toEqual({ kind: "skill", skill: "stealth" });
    expect(testARelancer({ kind: "save", entityId: "e", ability: "wis" })).toEqual({ kind: "save", ability: "wis" });
    expect(testARelancer({ kind: "ability", entityId: "e", ability: "str" })).toEqual({ kind: "ability", ability: "str" });
    expect(testARelancer({ kind: "initiative", entityId: "e" })).toBeNull();
    expect(testARelancer(undefined)).toBeNull();
  });
});

describe("bande d'après-jet", () => {
  const action = { kind: "skill", entityId: "e", skill: "stealth" } as const;

  it("n'apparaît que sur un échec, avec de l'inspiration, une seule fois", () => {
    expect(bandeRelanceVisible({ verdict: "fail", action, inspiration: 1, dejaRelance: false })).toBe(true);
    expect(bandeRelanceVisible({ verdict: "success", action, inspiration: 1, dejaRelance: false })).toBe(false);
    expect(bandeRelanceVisible({ verdict: null, action, inspiration: 1, dejaRelance: false })).toBe(false);
    expect(bandeRelanceVisible({ verdict: "fail", action, inspiration: 0, dejaRelance: false })).toBe(false);
    expect(bandeRelanceVisible({ verdict: "fail", action, inspiration: 2, dejaRelance: true })).toBe(false);
  });

  it("rien pour un jet libre ni pour une initiative", () => {
    expect(bandeRelanceVisible({ verdict: "fail", action: undefined, inspiration: 1, dejaRelance: false })).toBe(false);
    expect(bandeRelanceVisible({ verdict: "fail", action: { kind: "initiative", entityId: "e" }, inspiration: 1, dejaRelance: false })).toBe(false);
  });
});

describe("résultat", () => {
  it("max en ambre, 1 en rouge", () => {
    expect(etatDe(6, 6)).toBe("maximum");
    expect(etatDe(1, 6)).toBe("un");
    expect(etatDe(3, 6)).toBe("normal");
    expect(etatDe(100, 100)).toBe("maximum");
  });

  it("la paire de l'avantage n'est qu'un carré, les autres dés restent un par un", () => {
    const pair: AdvantagePair = { mode: "advantage", rolls: [4, 17], keptIndex: 1 };
    const carres = carresDuJet(
      [
        { faces: 20, rolls: [4, 17] },
        { faces: 6, rolls: [2, 5] },
      ],
      pair
    );
    expect(carres).toEqual([
      { type: "paire", mode: "advantage", rolls: [4, 17], keptIndex: 1 },
      { type: "de", faces: 6, valeur: 2 },
      { type: "de", faces: 6, valeur: 5 },
    ]);
  });

  it("deux d20 sans avantage restent deux dés", () => {
    expect(carresDuJet([{ faces: 20, rolls: [3, 9] }], null)).toHaveLength(2);
  });

  it("lit le DD privé et le secret d'un jet Realtime", () => {
    expect(lireDcPrive({ dcPrivate: true })).toBe(true);
    expect(lireDcPrive({ dc: 12 })).toBe(false);
    expect(lireDcPrive(null)).toBe(false);
    expect(lireDcPrive("x")).toBe(false);
    expect(estSecret("public")).toBe(false);
    expect(estSecret("gm")).toBe(true);
    expect(estSecret("roller")).toBe(true);
  });
});

describe("fusion de l'historique", () => {
  const jet = (id: string, createdAt: string): JetAffiche => ({
    id,
    who: "x",
    what: "y",
    chips: [],
    total: 1,
    dc: null,
    dcPrivate: false,
    verdict: null,
    naturalD20: null,
    secret: false,
    groups: [],
    pair: null,
    createdAt,
  });

  it("garde les jets reçus plus récents que l'historique, sans doublon, plafonnés", () => {
    const historique = [jet("b", "2026-01-02"), jet("a", "2026-01-01")];
    const enDirect = [jet("c", "2026-01-03"), jet("b", "2026-01-02"), jet("old", "2025-12-01")];
    expect(fusionnerJets(historique, enDirect, 30).map((j) => j.id)).toEqual(["c", "b", "a"]);
    expect(fusionnerJets(historique, enDirect, 2).map((j) => j.id)).toEqual(["c", "b"]);
  });
});
