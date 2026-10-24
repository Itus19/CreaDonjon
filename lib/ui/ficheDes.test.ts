import { describe, expect, it } from "vitest";
import { armeFiche, degatsProposes, formuleAvecModificateur, genreCiblableDuLancer, sortieAttaque, sortieDegats, sortieSort } from "@/lib/ui/ficheDes";

const arme = (extra: Partial<Parameters<typeof armeFiche>[0]["weapon"]> = {}) => ({
  damageDice: "1d8",
  damageType: "slashing",
  versatileDamageDice: null,
  properties: [] as string[],
  isRanged: false,
  masteryKey: null,
  ...extra,
});

describe("formuleAvecModificateur", () => {
  it("signe le modificateur et l'omet à zéro", () => {
    expect(formuleAvecModificateur("1d8", 3)).toBe("1d8+3");
    expect(formuleAvecModificateur("1d8", -1)).toBe("1d8-1");
    expect(formuleAvecModificateur("1d8", 0)).toBe("1d8");
  });
});

describe("armeFiche", () => {
  it("prend la caractéristique de l'arme et ajoute la maîtrise à la touche", () => {
    const a = armeFiche({ itemId: "i", nom: "Rapière", weapon: arme({ damageDice: "1d8", properties: ["finesse"] }), strMod: 1, dexMod: 3, proficiencyBonus: 2 });
    expect(a).toMatchObject({ itemId: "i", nom: "Rapière", modificateurAttaque: 5, formuleDegats: "1d8+3", formuleDeuxMains: null });
  });
  it("garde la formule à deux mains quand l'arme est polyvalente", () => {
    const a = armeFiche({ itemId: "i", nom: "Épée longue", weapon: arme({ versatileDamageDice: "1d10", properties: ["versatile"] }), strMod: 3, dexMod: 0, proficiencyBonus: 2 });
    expect(a.formuleDeuxMains).toBe("1d10+3");
  });
});

describe("sorties de la fiche", () => {
  const trace = [{ text: "2d20kh1 (7, 17)", value: 17 }, { text: "+5", value: 5 }];
  const attaque = { total: 22, trace, isCritical: false, isCriticalFail: false };

  it("une attaque avec avantage montre la paire et le d20 gardé", () => {
    const s = sortieAttaque(attaque, { who: "Rapière", what: "Rapière · Attaque" });
    expect(s).toMatchObject({ total: 22, naturalD20: 17, verdict: null, pair: { mode: "advantage", rolls: [7, 17], keptIndex: 1 } });
  });
  it("un 20 naturel est une réussite (or), un 1 naturel un échec", () => {
    expect(sortieAttaque({ ...attaque, isCritical: true }, { who: "", what: "" }).verdict).toBe("success");
    expect(sortieAttaque({ ...attaque, isCriticalFail: true }, { who: "", what: "" }).verdict).toBe("fail");
  });
  it("des dégâts n'ont ni verdict ni paire", () => {
    const s = sortieDegats({ total: 6, trace: [{ text: "1d8 (4)", value: 4 }, { text: "+2", value: 2 }] }, { who: "", what: "" });
    expect(s).toMatchObject({ total: 6, verdict: null, pair: null, naturalD20: null });
  });
  it("un sort sans dégâts montre un texte seul, sans total", () => {
    expect(sortieSort(undefined, { who: "Détection", what: "x" }, "Sort lancé")).toMatchObject({ what: "Sort lancé", sansTotal: true, trace: [] });
    expect(sortieSort({ total: 9, trace: [] }, { who: "a", what: "b" }, "Sort lancé").sansTotal).toBeUndefined();
  });
  it("un 1 naturel ne propose pas les dégâts", () => {
    expect(degatsProposes({ isCriticalFail: true })).toBe(false);
    expect(degatsProposes({ isCriticalFail: false })).toBe(true);
  });
  it("seuls la sauvegarde et le soin passent par le bouton de lancer ciblé", () => {
    expect(genreCiblableDuLancer("spell_save")).toBe("spell_save");
    expect(genreCiblableDuLancer("heal")).toBe("heal");
    expect(genreCiblableDuLancer("spell_attack")).toBeNull();
    expect(genreCiblableDuLancer(null)).toBeNull();
  });
});
