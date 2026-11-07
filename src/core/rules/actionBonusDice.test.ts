import { describe, expect, it } from "vitest";
import type { Rng } from "../dice/rng";
import { resolveAttackRoll, resolveCheckRoll, resolveDamageRoll } from "./action";

/**
 * V3.1-156 (ADR 0074) — les jets lancent les dés de bonus de la fiche
 * (Bénédiction : + 1d4) et lisent la plage de critique (Critique amélioré : 19).
 * Le serveur lance tout (règle 8) ; le détail du jet montre chaque dé.
 */

/** Rend les faces données dans l'ordre (1 à n). */
function faces(...f: number[]): Rng {
  let i = 0;
  return { nextInt: (max: number) => { const v = f[i++]; if (v === undefined || v > max) throw new Error(`face ${v} pour un d${max}`); return v - 1; } };
}
const BENI = [{ count: 1, faces: 4, label: "Bénédiction", source: "fx" }];

describe("dés de bonus et critique", () => {
  it("attaque bénie : 1d20 + bonus + 1d4, le d4 au détail", () => {
    const r = resolveAttackRoll({ abilityMod: 3, proficiencyBonus: 2, proficient: true, advantage: "normal", bonusDice: BENI }, faces(10, 3));
    expect(r.total).toBe(10 + 5 + 3);
    expect(r.expression).toContain("1d4");
    expect(r.trace.some((t) => t.text.startsWith("1d4"))).toBe(true);
  });

  it("le naturel reste le d20 : un 19 est critique avec une plage de 19, pas sans", () => {
    expect(resolveAttackRoll({ abilityMod: 0, proficiencyBonus: 2, proficient: true, advantage: "normal", critRange: 19 }, faces(19)).isCritical).toBe(true);
    expect(resolveAttackRoll({ abilityMod: 0, proficiencyBonus: 2, proficient: true, advantage: "normal" }, faces(19)).isCritical).toBe(false);
  });

  it("sauvegarde bénie", () => {
    const r = resolveCheckRoll({ modifier: 1, advantage: "normal", bonusDice: BENI }, faces(8, 4));
    expect(r.total).toBe(8 + 1 + 4);
  });

  it("dégâts : les dés de bonus doublent au critique, le bonus fixe non", () => {
    const r = resolveDamageRoll({ formula: "1d8", abilityMod: 3, bonus: 2, bonusDice: [{ count: 1, faces: 6, label: "X", source: "x" }], critical: true }, faces(1, 1, 1, 1));
    expect(r.total).toBe(1 + 1 + 1 + 1 + 3 + 2);
  });
});

describe("aides des jets", async () => {
  const { weaponAttackAbility, combineAdvantage } = await import("./action");
  it("caractéristique d'attaque : Dex à distance, la meilleure en finesse, Force sinon", () => {
    expect(weaponAttackAbility([], true, 3, 1)).toBe("dex");
    expect(weaponAttackAbility(["finesse"], false, 1, 3)).toBe("dex");
    expect(weaponAttackAbility([], false, 1, 3)).toBe("str");
  });
  it("avantage et désavantage s'annulent", () => {
    expect(combineAdvantage("normal", "advantage")).toBe("advantage");
    expect(combineAdvantage("disadvantage", "advantage")).toBe("normal");
    expect(combineAdvantage("advantage", "normal")).toBe("advantage");
  });
});
