import { describe, expect, it } from "vitest";
import { effectsForSaveOutcome, saveTotal, zSaveRequestEffect } from "./saveRequest";

/** V3.1-111 (ADR 0044) — ce que la sauvegarde demandée applique, selon la réponse. */
const charm = { on_fail: { damage: 0, conditions: ["charmed"] }, on_success: { damage: 0, conditions: [] } };
const flame = { on_fail: { damage: 7, damage_type: "radiant", conditions: [] }, on_success: { damage: 0, conditions: [] } };

describe("zSaveRequestEffect", () => {
  it("accepte dégâts et états des deux issues, refuse des dégâts négatifs", () => {
    expect(zSaveRequestEffect.safeParse(charm).success).toBe(true);
    expect(zSaveRequestEffect.safeParse({ ...flame, on_fail: { damage: -1, conditions: [] } }).success).toBe(false);
  });
});

describe("saveTotal", () => {
  it("lancé par le serveur ou vrai dé : le naturel plus le bonus de sauvegarde", () => {
    expect(saveTotal({ natural: 12, modifierIncluded: false }, 3)).toEqual({ natural: 12, total: 15 });
  });

  it("vrai dé « modificateur inclus » : le total tel quel, pas de naturel connu", () => {
    expect(saveTotal({ natural: 17, modifierIncluded: true }, 3)).toEqual({ natural: null, total: 17 });
  });
});

describe("effectsForSaveOutcome", () => {
  it("échec : les dégâts et les états de l'échec, sur la cible", () => {
    expect(effectsForSaveOutcome(flame, false, "participant:p1")).toEqual([
      { action: "deal_damage", who: "participant:p1", amount: 7, damage_type: "radiant" },
    ]);
    expect(effectsForSaveOutcome(charm, false, "pc-1")).toEqual([{ action: "apply_condition", who: "pc-1", key: "charmed" }]);
  });

  it("réussite : rien, ou ce que l'issue réussie garde (la moitié des dégâts)", () => {
    expect(effectsForSaveOutcome(charm, true, "pc-1")).toEqual([]);
    const half = { ...flame, on_success: { damage: 3, damage_type: "radiant", conditions: [] } };
    expect(effectsForSaveOutcome(half, true, "x")).toEqual([{ action: "deal_damage", who: "x", amount: 3, damage_type: "radiant" }]);
  });
});
