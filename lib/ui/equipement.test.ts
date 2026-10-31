import { describe, expect, it } from "vitest";
import type { InventoryBlockData, InventoryItem } from "@/src/core/schemas/blocks/inventory";
import { totalValueCp } from "@/src/core/rules/currency";
import { acheter, basculerPort, emplacementDe, filtrerBoutique, rendre } from "./equipement";

const ref = (key: string) => ({ kind: "rule", key }) as const;
const objet = (id: string, key: string, equipped = false): InventoryItem => ({ id, qty: 1, ref: ref(key), ...(equipped ? { equipped } : {}) });
const sac = (items: InventoryItem[], gp = 10): InventoryBlockData => ({ __v: 1, items, containers: [], currency: { pp: 0, gp, ep: 0, sp: 0, cp: 0 } });

describe("l'emplacement d'un objet (V3.1-53)", () => {
  it("armure, bouclier, arme ; rien pour le reste", () => {
    expect(emplacementDe({ category: "Heavy", base: 16, dexBonus: false }, null)).toBe("armor");
    expect(emplacementDe({ category: "Shield", base: 2, dexBonus: false }, null)).toBe("shield");
    expect(emplacementDe(null, { damageDice: "1d8", damageType: "slashing", versatileDamageDice: null, properties: [], isRanged: false, masteryKey: null })).toBe("main");
    expect(emplacementDe(null, null)).toBeNull();
  });
});

describe("la bande d'équipement : porter éteint l'ancien du même emplacement", () => {
  const items = [objet("a", "chain-mail", true), objet("b", "leather-armor"), objet("c", "mace", true), objet("d", "rope")];
  const emplacements = ["armor", "armor", "main", null] as const;

  it("allumer une armure range l'autre, sans toucher à l'arme", () => {
    const apres = basculerPort(items, 1, emplacements);
    expect(apres.map((i) => i.equipped === true)).toEqual([false, true, true, false]);
  });
  it("éteindre range l'objet", () => {
    expect(basculerPort(items, 0, emplacements)[0]!.equipped).toBe(false);
  });
  it("un objet qui ne se porte pas ne change rien", () => {
    expect(basculerPort(items, 3, emplacements)).toEqual(items);
  });
});

describe("acheter puis rendre : la bourse revient exactement à sa valeur", () => {
  it("achat payé en monnaie, retour remboursé en entier pendant la création", () => {
    const depart = sac([], 10);
    const achete = acheter(depart, objet("x", "rapier"), { quantity: 25, unit: "sp" });
    expect(achete).not.toBeNull();
    expect(totalValueCp(achete!.currency)).toBe(1000 - 250);
    expect(achete!.items).toHaveLength(1);
    const rendu = rendre(achete!, 0, { quantity: 25, unit: "sp" }, 1);
    expect(rendu.items).toHaveLength(0);
    expect(totalValueCp(rendu.currency)).toBe(totalValueCp(depart.currency));
  });
  it("la bourse ne suffit pas : refusé, rien ne change", () => {
    expect(acheter(sac([], 1), objet("x", "chain-mail"), { quantity: 75, unit: "gp" })).toBeNull();
  });
  it("en jeu, la revente rend la part du ruleset (arrondie au cuivre inférieur)", () => {
    const rendu = rendre(sac([objet("x", "dagger")], 0), 0, { quantity: 5, unit: "cp" }, 0.5);
    expect(totalValueCp(rendu.currency)).toBe(2);
  });
  it("une pile perd un exemplaire ; un objet sans prix est rendu sans remboursement", () => {
    const pile = sac([{ ...objet("t", "torch"), qty: 3 }], 0);
    expect(rendre(pile, 0, { quantity: 1, unit: "cp" }, 1).items[0]!.qty).toBe(2);
    expect(totalValueCp(rendre(sac([objet("m", "bag-of-holding")], 0), 0, null, 1).currency)).toBe(0);
  });
});

describe("la boutique cherchable", () => {
  const objets = [
    { cle: "rapier", texte: "Rapière arme de guerre 1d8 perforants finesse" },
    { cle: "mace", texte: "Masse d'armes arme courante 1d6 contondants" },
    { cle: "leather", texte: "Armure de cuir armure légère" },
  ];
  it("par propriété, sans accents ni casse ; chaque mot doit apparaître", () => {
    expect(filtrerBoutique(objets, "perforants").map((o) => o.cle)).toEqual(["rapier"]);
    expect(filtrerBoutique(objets, "LEGERE").map((o) => o.cle)).toEqual(["leather"]);
    expect(filtrerBoutique(objets, "arme courante").map((o) => o.cle)).toEqual(["mace"]);
  });
  it("une recherche vide rend tout", () => {
    expect(filtrerBoutique(objets, "  ")).toHaveLength(3);
  });
});
