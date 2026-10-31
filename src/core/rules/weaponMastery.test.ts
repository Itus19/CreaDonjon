import { describe, expect, it } from "vitest";
import { advantageFromMarkers, conditionLabel, expiredMasteryMarkers, isWeaponMastered, masteryMarker, masteryOnAttack, parseMasteryMarker } from "./weaponMastery";

const NAIVARA = "11111111-1111-4111-8111-111111111111";
const WORG = "22222222-2222-4222-8222-222222222222";

describe("les bottes d'armes maîtrisées (V3.1-148, SRD 5.2.1)", () => {
  it("une arme n'a sa botte que si elle est maîtrisée", () => {
    const choices = { "fighter.weapon_mastery": ["longsword", "shortbow", "dagger"] };
    expect(isWeaponMastered(choices, "longsword")).toBe(true);
    expect(isWeaponMastered(choices, "rapier")).toBe(false);
    expect(isWeaponMastered({}, "longsword")).toBe(false);
  });

  it("une marque se relit : genre, source, round", () => {
    expect(parseMasteryMarker(masteryMarker("sap", NAIVARA, 2))).toEqual({ kind: "sap", source: NAIVARA, round: 2 });
    expect(parseMasteryMarker("prone")).toBeNull();
  });

  it("Sape : touché, la cible porte la marque ; raté, rien", () => {
    const base = { mastery: "sap", targetKey: "participant:w", sourceId: NAIVARA, round: 2, abilityMod: 3, proficiencyBonus: 2, damageType: "slashing" };
    expect(masteryOnAttack({ ...base, verdict: "hit" }).effects).toEqual([{ action: "apply_condition", who: "participant:w", key: masteryMarker("sap", NAIVARA, 2) }]);
    expect(masteryOnAttack({ ...base, verdict: "miss" }).effects).toEqual([]);
  });

  it("Écorchure : raté, des dégâts égaux au modificateur ; Renversement : touché, une sauvegarde de Constitution DD 8 + mod + maîtrise", () => {
    const base = { targetKey: "participant:w", sourceId: NAIVARA, round: 2, abilityMod: 3, proficiencyBonus: 2, damageType: "slashing" };
    expect(masteryOnAttack({ ...base, mastery: "graze", verdict: "miss" }).effects).toEqual([{ action: "deal_damage", who: "participant:w", amount: 3, damage_type: "slashing" }]);
    expect(masteryOnAttack({ ...base, mastery: "graze", abilityMod: 0, verdict: "miss" }).effects).toEqual([]);
    expect(masteryOnAttack({ ...base, mastery: "topple", verdict: "hit" }).toppleSave).toEqual({ ability: "con", dc: 13 });
  });

  it("les bottes que le moteur ne joue pas encore (position, attaque de plus) se disent à la table", () => {
    const r = masteryOnAttack({ mastery: "push", verdict: "hit", targetKey: "participant:w", sourceId: NAIVARA, round: 1, abilityMod: 3, proficiencyBonus: 2, damageType: null });
    expect(r.effects).toEqual([]);
    expect(r.hints[0]).toMatch(/Poussée/);
  });

  it("le prochain jet d'attaque : sapé → désavantage ; vexé par cet attaquant → avantage ; les deux s'annulent ; la marque est consommée", () => {
    const sape = masteryMarker("sap", NAIVARA, 2);
    const vexe = masteryMarker("vex", NAIVARA, 2);
    expect(advantageFromMarkers({ attackerSource: WORG, attackerConditions: [sape], targetConditions: [], chosen: "normal" })).toMatchObject({
      advantage: "disadvantage",
      removeFromAttacker: [sape],
      removeFromTarget: [],
    });
    expect(advantageFromMarkers({ attackerSource: NAIVARA, attackerConditions: [], targetConditions: [vexe], chosen: "normal" })).toMatchObject({
      advantage: "advantage",
      removeFromTarget: [vexe],
    });
    // Vexé par un AUTRE attaquant : rien.
    expect(advantageFromMarkers({ attackerSource: WORG, attackerConditions: [], targetConditions: [vexe], chosen: "normal" }).advantage).toBe("normal");
    expect(advantageFromMarkers({ attackerSource: WORG, attackerConditions: [sape], targetConditions: [], chosen: "advantage" }).advantage).toBe("normal");
  });

  it("expiration : Sape au début du prochain tour de son auteur ; Vexation à la fin de son prochain tour", () => {
    const sape = masteryMarker("sap", NAIVARA, 2);
    const vexe = masteryMarker("vex", NAIVARA, 2);
    expect(expiredMasteryMarkers([sape, "prone"], { startingSource: NAIVARA, endingSource: WORG, round: 3 })).toEqual([sape]);
    // La fin du tour même où la Vexation est posée ne l'efface pas ; la fin du tour suivant, si.
    expect(expiredMasteryMarkers([vexe], { startingSource: WORG, endingSource: NAIVARA, round: 2 })).toEqual([]);
    expect(expiredMasteryMarkers([vexe], { startingSource: WORG, endingSource: NAIVARA, round: 3 })).toEqual([vexe]);
  });

  it("une marque se lit « Sapé » ou « Vexé » ; un autre état reste tel quel", () => {
    expect(conditionLabel(masteryMarker("sap", "p1", 2))).toBe("Sapé");
    expect(conditionLabel(masteryMarker("vex", "p1", 2))).toBe("Vexé");
    expect(conditionLabel("À terre")).toBe("À terre");
    expect(conditionLabel("botte:inconnue")).toBe("botte:inconnue");
  });
});
