import { describe, expect, it } from "vitest";
import { resolveEffectList, zEffect, type TriggerContext } from "./triggers";
import { applyEffects, type TurnState } from "./turn";
import type { Rng } from "../dice/rng";

/**
 * V3.1-183 (ADR 0078) — l'effet « PV temporaires », et le résultat du dé
 * qu'une utilisation vient de lancer, relu par les effets qui suivent
 * (`event.last_roll`). Mante d'inspiration : « autant de PV temporaires que
 * le double du nombre obtenu sur le dé d'Inspiration bardique ».
 */

const rngFixe = (valeur: number): Rng => ({ nextInt: () => valeur - 1 });
const ctx: TriggerContext = {
  actors: {
    self: { conditions: [], features: [], numbers: { "ability.cha": 3 }, zone: "near", resources: {} },
    target: { conditions: [], features: [], numbers: {}, zone: "near", resources: {} },
  },
} as unknown as TriggerContext;

describe("l'effet « PV temporaires »", () => {
  it("fait partie du vocabulaire fermé des effets", () => {
    expect(zEffect.safeParse({ action: "temp_hp", who: "target", amount: { op: "num", value: 6 } }).success).toBe(true);
    expect(zEffect.safeParse({ action: "temp_hp", who: "target" }).success).toBe(false);
  });

  it("relit le dé lancé juste avant : 2 × le résultat", () => {
    const resolus = resolveEffectList(
      [
        { action: "roll", label: "Inspiration bardique", formula: { op: "dice", count: { op: "num", value: 1 }, faces: { op: "num", value: 6 } } },
        { action: "temp_hp", who: "target", amount: { op: "mul", args: [{ op: "num", value: 2 }, { op: "ref", name: "event.last_roll" }] } },
      ],
      ctx,
      { event: "turn_start", subject: "self" },
      rngFixe(4)
    );
    expect(resolus[0]).toMatchObject({ action: "roll", value: 4 });
    expect(resolus[1]).toEqual({ action: "temp_hp", who: "target", amount: 8 });
  });

  it("ne s'additionne pas : on garde le plus grand des deux", () => {
    const etat: TurnState = {
      scene: { round: 1, zone: {} },
      actors: { target: { hp: { current: 10, max: 20, temp: 5 }, conditions: [], resources: {}, budget: { action: 1, bonus: 1, reaction: 1, movement: 30 } } },
    } as unknown as TurnState;
    const plusPetit = applyEffects(etat, [{ action: "temp_hp", who: "target", amount: 3 }]);
    expect(plusPetit.state.actors.target.hp).toEqual({ current: 10, max: 20, temp: 5 });
    const plusGrand = applyEffects(etat, [{ action: "temp_hp", who: "target", amount: 8 }]);
    expect(plusGrand.state.actors.target.hp).toEqual({ current: 10, max: 20, temp: 8 });
    expect(plusGrand.changes).toContainEqual({ kind: "hp", who: "target", from: { current: 10, max: 20, temp: 5 }, to: { current: 10, max: 20, temp: 8 }, note: "PV temporaires : 8" });
  });
});
