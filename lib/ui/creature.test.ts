import { describe, expect, it } from "vitest";
import {
  libellesInstances,
  ACTIONS_DE_BASE,
  bonusMaitrise,
  capacitesARecharge,
  formaterNombre,
  instanceChoisie,
  jetD20,
  jetDegats,
  lireCombat,
  lireJets,
  lireRecharge,
  lireVitesses,
  modeFiche,
  modificateur,
  perceptionPassive,
  pvApresEcart,
  sectionsActions,
  signe,
  valeurFp,
  xpDuFp,
} from "./creature";
import { zStatblockBlockData } from "@/src/core/schemas/blocks/statblock";

describe("modificateurs", () => {
  it("FOR 19 donne +4, et chaque valeur son modificateur", () => {
    expect(modificateur(19)).toBe(4);
    expect(modificateur(10)).toBe(0);
    expect(modificateur(9)).toBe(-1);
    expect(modificateur(1)).toBe(-5);
    expect(signe(4)).toBe("+4");
    expect(signe(-1)).toBe("-1");
    expect(signe(0)).toBe("+0");
  });
  it("jamais stockés : le schéma du bloc n'a aucun champ de modificateur ni de jeu", () => {
    const cles = Object.keys(zStatblockBlockData.shape);
    expect(cles).not.toEqual(expect.arrayContaining(["modifiers", "mods", "hp_current", "conditions", "recharge"]));
    expect(cles.filter((c) => /mod|current|condition|recharge|temp/.test(c))).toEqual([]);
  });
});

describe("facteur de puissance", () => {
  it("lit les fractions et les entiers, refuse le reste", () => {
    expect(valeurFp("1/4")).toBe(0.25);
    expect(valeurFp("8")).toBe(8);
    expect(valeurFp("")).toBeNull();
    expect(valeurFp("huit")).toBeNull();
    expect(valeurFp("31")).toBeNull();
  });
  it("PX et maîtrise sont dérivés du FP", () => {
    expect(xpDuFp("8")).toBe(3900);
    expect(xpDuFp("1/2")).toBe(100);
    expect(xpDuFp(undefined)).toBeNull();
    expect([bonusMaitrise("0"), bonusMaitrise("4"), bonusMaitrise("5"), bonusMaitrise("8"), bonusMaitrise("9"), bonusMaitrise("17"), bonusMaitrise("30")]).toEqual([2, 2, 3, 3, 4, 6, 9]);
    expect(bonusMaitrise("1/4")).toBe(2);
  });
  it("sépare les milliers", () => {
    expect(formaterNombre(3900)).toBe("3 900");
    expect(formaterNombre(155000)).toBe("155 000");
    expect(formaterNombre(50)).toBe("50");
  });
});

describe("lireVitesses", () => {
  it("la marche d'un côté, vol et nage dessous", () => {
    expect(lireVitesses("12 m, vol 24 m, nage 12 m")).toEqual({ principale: "12 m", autres: ["vol 24 m", "nage 12 m"] });
  });
  it("accepte l'anglais et une seule vitesse", () => {
    expect(lireVitesses("30 ft., fly 60 ft.")).toEqual({ principale: "30 ft.", autres: ["fly 60 ft."] });
    expect(lireVitesses("9 m")).toEqual({ principale: "9 m", autres: [] });
  });
  it("sans marche, la ligne principale est vide et le reste dessous", () => {
    expect(lireVitesses("vol 18 m")).toEqual({ principale: "", autres: ["vol 18 m"] });
  });
});

describe("perceptionPassive", () => {
  it("10 + Perception saisie, sinon 10 + Sagesse", () => {
    expect(perceptionPassive({ abilities: { wis: 12 }, skills: { perception: 7 } })).toBe(17);
    expect(perceptionPassive({ abilities: { wis: 12 } })).toBe(11);
  });
});

describe("lireRecharge", () => {
  it("lit la plage, en français comme en anglais", () => {
    expect(lireRecharge("Souffle (recharge 5–6). Cône de 9 m")).toEqual({ min: 5, max: 6, libelle: "5–6" });
    expect(lireRecharge("Recharge 6")).toEqual({ min: 6, max: 6, libelle: "6" });
    expect(lireRecharge("(Recharge 4-6)")).toEqual({ min: 4, max: 6, libelle: "4–6" });
  });
  it("rien quand le texte n'en parle pas ou la plage est absurde", () => {
    expect(lireRecharge("Morsure. +7 pour toucher")).toBeNull();
    expect(lireRecharge("recharge 7")).toBeNull();
    expect(lireRecharge("recharge 6–5")).toBeNull();
  });
});

describe("lireJets", () => {
  it("l'attaque : bonus, dégâts dans l'ordre, sans espace", () => {
    expect(lireJets("Attaque au corps à corps : +7 pour toucher, allonge 3 m. Touché : 13 (2d6 + 4) tranchant plus 7 (2d6) poison")).toEqual({
      toucher: 7,
      degats: ["2d6+4", "2d6"],
    });
  });
  it("le DD d'un souffle", () => {
    expect(lireJets("Jet de sauvegarde de Constitution DD 14. 42 (12d6) poison")).toEqual({ degats: ["12d6"], dd: 14 });
  });
  it("lit aussi la forme du SRD 2024", () => {
    expect(lireJets("Melee Attack Roll: +5, reach 5 ft. Hit: 7 (1d8 + 3) Slashing").toucher).toBe(5);
  });
  it("un texte sans jet ne donne rien", () => {
    expect(lireJets("respire à l'air libre et sous l'eau.")).toEqual({ degats: [] });
  });
});

describe("sectionsActions", () => {
  const donnees = {
    actions: [
      { name: "Attaques multiples", text: "trois attaques de Lacération" },
      { name: "Lacération", text: "+7 pour toucher. 2d6+4 tranchant" },
      { name: "Souffle empoisonné (recharge 5–6)", text: "DD 14, 12d6 poison" },
    ],
    reactions: [],
    legendary_actions: [],
  };
  it("sépare attaques et capacités, garde les réactions, omet les légendaires absentes", () => {
    const s = sectionsActions(donnees);
    expect(s.map((x) => x.cle)).toEqual(["attaques", "capacites", "reactions"]);
    expect(s[0]!.entrees.map((e) => e.name)).toEqual(["Attaques multiples", "Lacération"]);
    expect(s[1]!.entrees.map((e) => e.name)).toEqual(["Souffle empoisonné (recharge 5–6)"]);
    expect(s[2]!.entrees).toEqual([]);
  });
  it("montre les actions légendaires quand il y en a", () => {
    const s = sectionsActions({ ...donnees, legendary_actions: [{ name: "Queue", text: "+7 pour toucher" }] });
    expect(s.at(-1)!.cle).toBe("legendaires");
  });
  it("« Ce qui se recharge » ne retient que les capacités à recharge", () => {
    const r = capacitesARecharge(sectionsActions(donnees));
    expect(r.map((e) => e.name)).toEqual(["Souffle empoisonné (recharge 5–6)"]);
    expect(r[0]!.recharge.libelle).toBe("5–6");
    expect(capacitesARecharge(sectionsActions({ actions: [], reactions: [], legendary_actions: [] }))).toEqual([]);
  });
  it("a des actions de base", () => {
    expect(ACTIONS_DE_BASE.length).toBeGreaterThan(5);
  });
});

describe("la formule envoyée à l'outil de dés", () => {
  it("test, sauvegarde, attaque : un d20 et le modificateur", () => {
    expect(jetD20("Test de Force", 4)).toEqual({ label: "Test de Force", dice: { d20: 1 }, modifier: 4 });
    expect(jetD20("Lacération", 7).modifier).toBe(7);
  });
  it("les dégâts de Lacération : 2d6+4 et 2d6 deviennent 4d6+4", () => {
    expect(jetDegats("Lacération · dégâts", ["2d6+4", "2d6"])).toEqual({ label: "Lacération · dégâts", dice: { d6: 4 }, modifier: 4 });
  });
  it("des dés différents restent séparés, un modificateur négatif se garde", () => {
    expect(jetDegats("x", ["1d8-1", "1d4"])).toEqual({ label: "x", dice: { d8: 1, d4: 1 }, modifier: -1 });
  });
  it("une formule illisible ou un dé inconnu : un d6 de départ, jamais un résultat", () => {
    expect(jetDegats("x", ["n'importe quoi"]).dice).toEqual({ d6: 1 });
    expect(jetDegats("x", ["2d7"]).dice).toEqual({ d6: 1 });
  });
});

describe("hors combat, en combat", () => {
  const corps = {
    combat: {
      campaignId: "c1",
      combatId: "k1",
      instances: [
        { participantId: "p1", label: "Gobelin 1", hpCurrent: 5, hpMax: 7, tempHp: 0, conditions: [] },
        { participantId: "p2", label: "Gobelin 2", hpCurrent: 7, hpMax: 7, tempHp: 2, conditions: ["Aveuglé"] },
      ],
    },
  };
  it("hors combat quand la réponse est vide, illisible ou sans instance", () => {
    expect(modeFiche(lireCombat({ combat: null }))).toBe("hors-combat");
    expect(modeFiche(lireCombat("n'importe quoi"))).toBe("hors-combat");
    expect(modeFiche(lireCombat({ combat: { campaignId: "c", combatId: "k", instances: [] } }))).toBe("hors-combat");
  });
  it("en combat quand il y a des instances", () => {
    const c = lireCombat(corps);
    expect(modeFiche(c)).toBe("en-combat");
    expect(c!.instances).toHaveLength(2);
  });
  it("l'instance choisie, sinon la première", () => {
    const c = lireCombat(corps)!;
    expect(instanceChoisie(c, "p2").label).toBe("Gobelin 2");
    expect(instanceChoisie(c, "disparue").label).toBe("Gobelin 1");
    expect(instanceChoisie(c, null).label).toBe("Gobelin 1");
  });
  it("les PV après un écart restent entre 0 et le maximum", () => {
    expect(pvApresEcart({ hpCurrent: 5, hpMax: 7 }, -3)).toBe(2);
    expect(pvApresEcart({ hpCurrent: 5, hpMax: 7 }, -30)).toBe(0);
    expect(pvApresEcart({ hpCurrent: 5, hpMax: 7 }, 30)).toBe(7);
  });
});

import { tailleCourte } from "./creature";
describe("tailleCourte", () => {
  it("abrège les tailles connues, deux mots avant un", () => {
    expect([tailleCourte("Grande"), tailleCourte("Très grande"), tailleCourte("Moyenne"), tailleCourte("Large"), tailleCourte("Tiny"), tailleCourte("Très petite")]).toEqual(["G", "TG", "M", "G", "TP", "TP"]);
  });
  it("garde une taille inconnue, tiret si vide", () => {
    expect(tailleCourte("Colossale")).toBe("Colossale");
    expect(tailleCourte("")).toBe("—");
  });
});

describe("libellesInstances", () => {
  it("numérote les instances qui portent le même nom, laisse un nom unique tel quel", () => {
    const r = libellesInstances([
      { participantId: "a", label: "Gobelin" },
      { participantId: "b", label: "Gobelin" },
      { participantId: "c", label: "Chef gobelin" },
    ]);
    expect(r.map((x) => x.label)).toEqual(["Gobelin · 1", "Gobelin · 2", "Chef gobelin"]);
    expect(r.map((x) => x.value)).toEqual(["a", "b", "c"]);
  });
});

import { ajouterDefense, definirRepaire, retirerDefense } from "./creature";
import type { StatblockBlockData } from "@/src/core/schemas/blocks/statblock";

describe("repaire et défenses", () => {
  const base = {
    __v: 1, size: "M", creature_type: "x", ac: { value: 10 }, hp: { value: 5 }, speed: "9 m",
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    traits: [], actions: [], reactions: [], legendary_actions: [],
  } as StatblockBlockData;
  it("ajoute en rognant, refuse le vide et le doublon", () => {
    const a = ajouterDefense(base, "damage_immunities", "  feu ");
    expect(a.defenses).toEqual({ damage_immunities: ["feu"] });
    expect(ajouterDefense(a, "damage_immunities", "Feu")).toBe(a);
    expect(ajouterDefense(a, "damage_immunities", "   ")).toBe(a);
  });
  it("vider une liste supprime sa clé, puis `defenses`", () => {
    let d = ajouterDefense(base, "damage_immunities", "feu");
    d = ajouterDefense(d, "condition_immunities", "empoisonné");
    d = retirerDefense(d, "damage_immunities", "feu");
    expect(Object.keys(d.defenses ?? {})).toEqual(["condition_immunities"]);
    d = retirerDefense(d, "condition_immunities", "empoisonné");
    expect("defenses" in d).toBe(false);
  });
  it("le repaire : `null` supprime la clé", () => {
    const d = definirRepaire(base, "e1");
    expect(d.lair).toEqual({ kind: "entity", id: "e1" });
    expect("lair" in definirRepaire(d, null)).toBe(false);
  });
});
