import { describe, expect, it } from "vitest";
import { defaultRuntimeState, type RuntimeState } from "../schemas/runtimeState";
import { applyRestEffects, clearedSpellSlots } from "./restEffects";

function rested(overrides: Partial<RuntimeState> = {}): RuntimeState {
  return { ...defaultRuntimeState(), hp: { current: 20, temp: 0 }, ...overrides };
}

const OPTS = { hpMax: 30, inspirationMax: 1 };

describe("applyRestEffects (ADR 0050, V3.1-5)", () => {
  it("accorde l'inspiration a un personnage qui n'en a pas", () => {
    const out = applyRestEffects(rested(), [{ action: "grant_inspiration", who: "self" }], OPTS);
    expect(out.state.inspiration).toBe(1);
    expect(out.applied).toEqual(["Inspiration héroïque : 0 → 1"]);
    expect(out.ignored).toEqual([]);
  });

  it("n'accorde rien au-dela du maximum, et le dit", () => {
    const out = applyRestEffects(rested({ inspiration: 1 }), [{ action: "grant_inspiration", who: "self" }], OPTS);
    expect(out.state.inspiration).toBe(1);
    expect(out.applied).toEqual([]);
    expect(out.ignored).toEqual([{ action: "grant_inspiration", reason: "Inspiration héroïque déjà au maximum (1)." }]);
  });

  it("soigne dans la limite des PV max", () => {
    const out = applyRestEffects(rested(), [{ action: "heal", who: "self", amount: 15 }], OPTS);
    expect(out.state.hp.current).toBe(30);
    expect(out.applied).toEqual(["Soins : 20 → 30 PV"]);
  });

  it("pose et retire une condition", () => {
    const out = applyRestEffects(
      rested({ conditions: ["poisoned"] }),
      [
        { action: "remove_condition", who: "self", key: "poisoned" },
        { action: "apply_condition", who: "self", key: "blessed" },
      ],
      OPTS
    );
    expect(out.state.conditions).toEqual(["blessed"]);
    expect(out.applied).toEqual(["Condition retirée : poisoned", "Condition posée : blessed"]);
  });

  it("ignore, en le disant, un effet qui vise un autre acteur ou qu'un repos n'applique pas", () => {
    const out = applyRestEffects(
      rested(),
      [
        { action: "grant_inspiration", who: "allie" },
        { action: "grant_budget", who: "self", kind: "action", amount: 1 },
        { action: "narrate_hint", text: "Un reve etrange." },
      ],
      OPTS
    );
    expect(out.state).toEqual(rested());
    expect(out.ignored.map((i) => i.action)).toEqual(["grant_inspiration", "grant_budget", "narrate_hint"]);
  });

  it("ne modifie pas l'etat recu", () => {
    const before = rested();
    applyRestEffects(before, [{ action: "grant_inspiration", who: "self" }], OPTS);
    expect(before.inspiration).toBe(0);
  });
});

describe("clearedSpellSlots", () => {
  it("remet a zero chaque niveau consomme : un objet vide ne remettrait rien, la fusion se fait cle par cle", () => {
    expect(clearedSpellSlots({ "1": 2, "3": 1 })).toEqual({ "1": 0, "3": 0 });
    expect(clearedSpellSlots({})).toEqual({});
  });
});
