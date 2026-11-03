import { describe, expect, it } from "vitest";
import type { Rng } from "../dice/rng";
import { abilityKey, isSpent, rechargeAbilitiesFrom, rollRechargesAtTurnStart, spendAbility } from "./creatureRecharge";

/**
 * V3.1-129, reçu de V3.1-79 — la recharge d'une capacité de créature
 * (« Souffle empoisonné (recharge 5–6) ») : une ressource à un usage dont
 * l'état vit dans l'INSTANCE de combat, jamais dans le bloc de la créature
 * (qui reste un modèle). Chaque instance a le sien.
 */

const d6 = (...faces: number[]): Rng => {
  let i = 0;
  return { nextInt: (max) => { if (max !== 6) throw new Error("un d6 attendu"); return faces[i++] - 1; } };
};

const SOUFFLE = { key: abilityKey("Souffle empoisonné"), recharge: { min: 5, max: 6 } };

describe("recharge d'une capacité de créature", () => {
  it("la clé d'une capacité se lit dans son nom, stable et sans accent", () => {
    expect(abilityKey("Souffle empoisonné (Recharge 5–6)")).toBe("souffle-empoisonne");
  });

  it("un souffle dépensé par « Gobelin 1 » ne l'est pas pour « Gobelin 2 »", () => {
    const gobelin1 = spendAbility({}, SOUFFLE.key);
    const gobelin2 = {};
    expect(isSpent(gobelin1, SOUFFLE.key)).toBe(true);
    expect(isSpent(gobelin2, SOUFFLE.key)).toBe(false);
  });

  it("au début du tour, un d6 lancé par le serveur à 5 ou 6 le rend prêt", () => {
    for (const face of [5, 6]) {
      const r = rollRechargesAtTurnStart([SOUFFLE], spendAbility({}, SOUFFLE.key), d6(face));
      expect(isSpent(r.used, SOUFFLE.key)).toBe(false);
      expect(r.rolls).toEqual([{ key: SOUFFLE.key, roll: face, recharged: true }]);
    }
  });

  it("à 1–4, il reste dépensé", () => {
    for (const face of [1, 2, 3, 4]) {
      const r = rollRechargesAtTurnStart([SOUFFLE], spendAbility({}, SOUFFLE.key), d6(face));
      expect(isSpent(r.used, SOUFFLE.key)).toBe(true);
      expect(r.rolls).toEqual([{ key: SOUFFLE.key, roll: face, recharged: false }]);
    }
  });

  it("une capacité prête ne lance aucun dé", () => {
    expect(rollRechargesAtTurnStart([SOUFFLE], {}, d6())).toEqual({ used: {}, rolls: [] });
  });

  it("« recharge 6 » : seul un 6 la rend prête", () => {
    const six = { key: "griffe", recharge: { min: 6, max: 6 } };
    expect(isSpent(rollRechargesAtTurnStart([six], spendAbility({}, "griffe"), d6(5)).used, "griffe")).toBe(true);
    expect(isSpent(rollRechargesAtTurnStart([six], spendAbility({}, "griffe"), d6(6)).used, "griffe")).toBe(false);
  });

  it("lit les capacités à recharge d'une liste d'actions, dans le nom ou le texte", () => {
    expect(
      rechargeAbilitiesFrom([
        { name: "Morsure", text: "Attaque au corps à corps : +4." },
        { name: "Souffle empoisonné (Recharge 5–6)", text: "Cône de 4,5 m." },
        { name: "Rugissement", text: "Chaque créature… (recharge 6)." },
      ]),
    ).toEqual([
      { key: "souffle-empoisonne", name: "Souffle empoisonné", recharge: { min: 5, max: 6 } },
      { key: "rugissement", name: "Rugissement", recharge: { min: 6, max: 6 } },
    ]);
  });
});
