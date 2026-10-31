import { describe, expect, it } from "vitest";
import { attackFactForPlayer, describeChangeForPlayer, woundState } from "./playerFacing";

describe("ce qu'un joueur lit d'un jet ciblé (V3.1-107, ADR 0069)", () => {
  it("l'état de blessure, comme la vue de V3.1-102", () => {
    expect(woundState(7, 7)).toBe("unhurt");
    expect(woundState(5, 7)).toBe("hurt");
    expect(woundState(3, 7)).toBe("bloodied");
    expect(woundState(0, 7)).toBe("down");
  });

  it("un adversaire : jamais ses PV, son état de blessure ; un allié : ses PV", () => {
    const hp = (current: number) => ({ current, max: 26, temp: 0 });
    const gobelin = { name: "Worg", ally: false, hpMax: 26 };
    const naivara = { name: "Naivara", ally: true, hpMax: 20 };
    expect(describeChangeForPlayer({ kind: "hp", who: "w", from: hp(26), to: hp(10), note: "dégâts" }, () => gobelin)).toBe("Worg est en sang.");
    expect(describeChangeForPlayer({ kind: "hp", who: "w", from: hp(26), to: hp(0), note: "dégâts" }, () => gobelin)).toBe("Worg est à terre.");
    expect(describeChangeForPlayer({ kind: "hp", who: "n", from: { current: 12, max: 20, temp: 0 }, to: { current: 8, max: 20, temp: 0 }, note: "dégâts" }, () => naivara)).toBe(
      "Naivara : 12 → 8 PV (dégâts)"
    );
    expect(describeChangeForPlayer({ kind: "condition", who: "w", key: "prone", added: true }, () => gobelin)).toBe("Worg subit : prone");
    expect(describeChangeForPlayer({ kind: "hint", text: "x" }, () => gobelin)).toBeNull();
  });

  it("le verdict sans la CA de la cible", () => {
    expect(attackFactForPlayer({ actor: "Naivara", target: "Worg", label: "Épée longue", total: 17, verdict: "hit", critical: false, criticalFail: false })).toBe(
      "Naivara attaque Worg (Épée longue) : 17 — touché."
    );
    expect(attackFactForPlayer({ actor: "Naivara", target: "Worg", label: "Épée longue", total: 4, verdict: "miss", critical: false, criticalFail: true })).toBe(
      "Naivara attaque Worg (Épée longue) : 4 — raté (échec critique)."
    );
    expect(attackFactForPlayer({ actor: "Naivara", target: "Worg", label: "Épée longue", total: 12, verdict: null, critical: false, criticalFail: false })).toBe(
      "Naivara attaque Worg (Épée longue) : 12 — la table tranche."
    );
  });
});
