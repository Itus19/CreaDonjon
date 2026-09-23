import { describe, expect, it } from "vitest";
import { defaultRuntimeState, zRuntimeState } from "./runtimeState";

/** Une ligne `entity_runtime_state` telle qu'elle a ete ecrite AVANT V2.1-26 : sans inspiration. */
const ETAT_AVANT_INSPIRATION = {
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

describe("zRuntimeState", () => {
  it("valide un etat complet (specs/wiki-blocs.md §4.2)", () => {
    const state = { ...ETAT_AVANT_INSPIRATION, inspiration: 1 };
    expect(zRuntimeState.parse(state)).toEqual(state);
  });

  it("relit une ligne ecrite AVANT l'inspiration, et lui donne zero", () => {
    // V2.1-26, le seul risque de ce ticket : `zRuntimeState.parse` tourne a
    // chaque ouverture de fiche (`getOrInitializeRuntimeState`). Un champ
    // requis aurait rendu illisibles toutes les lignes deja en base.
    expect(zRuntimeState.parse(ETAT_AVANT_INSPIRATION)).toEqual({ ...ETAT_AVANT_INSPIRATION, inspiration: 0 });
  });

  it("rejette une inspiration hors bornes", () => {
    expect(() => zRuntimeState.parse({ ...defaultRuntimeState(), inspiration: -1 })).toThrow();
    expect(() => zRuntimeState.parse({ ...defaultRuntimeState(), inspiration: 6 })).toThrow();
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
