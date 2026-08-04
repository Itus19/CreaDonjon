import { describe, expect, it } from "vitest";
import { defaultRuntimeState, zRuntimeState } from "./runtimeState";

describe("zRuntimeState", () => {
  it("valide un etat complet (specs/wiki-blocs.md §4.2)", () => {
    const state = {
      hp: { current: 12, temp: 0 },
      hit_dice: { d10: 1 },
      exhaustion: 0,
      xp: 0,
      resources: { r1: 2, r2: 5 },
      spell_slots_used: { "1": 0 },
      conditions: ["prone"],
      death_saves: { success: 0, fail: 0 },
      attuned: ["ent_excalibur"],
    };
    expect(zRuntimeState.parse(state)).toEqual(state);
  });

  it("valide l'etat par defaut", () => {
    expect(() => zRuntimeState.parse(defaultRuntimeState())).not.toThrow();
  });

  it("rejette des PV courants negatifs", () => {
    expect(() => zRuntimeState.parse({ ...defaultRuntimeState(), hp: { current: -1, temp: 0 } })).toThrow();
  });

  it("rejette un jet de sauvegarde contre la mort hors bornes (max 3)", () => {
    expect(() =>
      zRuntimeState.parse({ ...defaultRuntimeState(), death_saves: { success: 4, fail: 0 } })
    ).toThrow();
  });

  it("rejette un epuisement hors bornes (0 a 6)", () => {
    expect(() => zRuntimeState.parse({ ...defaultRuntimeState(), exhaustion: 7 })).toThrow();
  });
});
