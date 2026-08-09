import { describe, expect, it } from "vitest";
import { resolveAttackRoll, resolveDamageRoll, weaponAttackAbilityMod } from "./action";

// Meme convention que src/core/formula/evaluate.test.ts : un RNG factice a
// sequence fixe. nextInt(20) renvoie une valeur 0-indexee, +1 donne la face
// reellement obtenue (rollDice, src/core/dice/roll.ts) : 19 -> naturel 20,
// 0 -> naturel 1.
function sequenceRng(sequence: number[]) {
  let i = 0;
  return { nextInt: () => sequence[i++] };
}

describe("resolveAttackRoll", () => {
  it("d20 normal + modificateur (caracteristique + maitrise)", () => {
    const rng = sequenceRng([13]); // naturel 14
    const result = resolveAttackRoll(
      { abilityMod: 1, proficiencyBonus: 2, proficient: true, advantage: "normal" },
      rng,
    );
    expect(result.total).toBe(17); // 14 + 1 + 2
    expect(result.isCritical).toBe(false);
    expect(result.isCriticalFail).toBe(false);
  });

  it("n'ajoute pas le bonus de maitrise si non maitrise", () => {
    const rng = sequenceRng([13]);
    const result = resolveAttackRoll(
      { abilityMod: 1, proficiencyBonus: 2, proficient: false, advantage: "normal" },
      rng,
    );
    expect(result.total).toBe(15); // 14 + 1, pas de +2
  });

  it("naturel 20 : critique, quel que soit le modificateur", () => {
    const rng = sequenceRng([19]); // naturel 20
    const result = resolveAttackRoll(
      { abilityMod: -3, proficiencyBonus: 2, proficient: true, advantage: "normal" },
      rng,
    );
    expect(result.isCritical).toBe(true);
    expect(result.isCriticalFail).toBe(false);
  });

  it("naturel 1 : echec critique", () => {
    const rng = sequenceRng([0]); // naturel 1
    const result = resolveAttackRoll(
      { abilityMod: 5, proficiencyBonus: 2, proficient: true, advantage: "normal" },
      rng,
    );
    expect(result.isCriticalFail).toBe(true);
    expect(result.isCritical).toBe(false);
  });

  it("avantage : garde le plus haut des deux d20, et le critique suit ce de garde", () => {
    const rng = sequenceRng([5, 19]); // naturels 6 puis 20 -> garde 20
    const result = resolveAttackRoll(
      { abilityMod: 0, proficiencyBonus: 0, proficient: false, advantage: "advantage" },
      rng,
    );
    expect(result.total).toBe(20);
    expect(result.isCritical).toBe(true);
  });

  it("desavantage : garde le plus bas des deux d20", () => {
    const rng = sequenceRng([19, 5]); // naturels 20 puis 6 -> garde 6
    const result = resolveAttackRoll(
      { abilityMod: 0, proficiencyBonus: 0, proficient: false, advantage: "disadvantage" },
      rng,
    );
    expect(result.total).toBe(6);
    expect(result.isCritical).toBe(false);
  });

  it("porte une trace lisible", () => {
    const rng = sequenceRng([13]);
    const result = resolveAttackRoll(
      { abilityMod: 1, proficiencyBonus: 2, proficient: true, advantage: "normal" },
      rng,
    );
    expect(result.trace.length).toBeGreaterThan(0);
    expect(result.trace.some((step) => step.text.includes("1d20"))).toBe(true);
  });
});

describe("resolveDamageRoll", () => {
  it("formule simple + modificateur de caracteristique", () => {
    const rng = sequenceRng([4]); // 1d6 -> 5
    const result = resolveDamageRoll({ formula: "1d6", abilityMod: 1, critical: false }, rng);
    expect(result.total).toBe(6);
  });

  it("critique : double le nombre de des, jamais le modificateur", () => {
    const rng = sequenceRng([4, 2]); // 2d6 -> 5, 3 = 8
    const result = resolveDamageRoll({ formula: "1d6", abilityMod: 1, critical: true }, rng);
    expect(result.total).toBe(9); // 8 + 1, pas +2
  });

  it("critique sur une formule composee : double CHAQUE terme en des", () => {
    const rng = sequenceRng([4, 2, 0, 3]); // 2d6 (5,3=8) + 2d4 (1,4=5)
    const result = resolveDamageRoll({ formula: "1d6+1d4", critical: true }, rng);
    expect(result.total).toBe(13);
  });

  it("sans modificateur ni bonus, ne reference pas {mod}", () => {
    const rng = sequenceRng([2]); // 1d6 -> 3
    const result = resolveDamageRoll({ formula: "1d6", critical: false }, rng);
    expect(result.total).toBe(3);
  });
});

describe("weaponAttackAbilityMod", () => {
  it("arme a distance : toujours Dex", () => {
    expect(weaponAttackAbilityMod([], true, 3, 1)).toBe(1);
  });

  it("arme de corps a corps sans finesse : toujours Force", () => {
    expect(weaponAttackAbilityMod([], false, 3, 1)).toBe(3);
  });

  it("arme de corps a corps avec finesse : le meilleur des deux", () => {
    expect(weaponAttackAbilityMod(["finesse", "light"], false, 1, 4)).toBe(4);
    expect(weaponAttackAbilityMod(["finesse"], false, 5, 2)).toBe(5);
  });
});
