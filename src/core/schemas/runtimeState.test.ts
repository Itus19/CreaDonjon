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
    expect(zRuntimeState.parse(state)).toEqual({ ...state, pending_request: null, concentration: null, pact_slots_used: 0 });
  });

  it("relit une ligne ecrite AVANT l'inspiration, et lui donne zero", () => {
    // V2.1-26, le seul risque de ce ticket : `zRuntimeState.parse` tourne a
    // chaque ouverture de fiche (`getOrInitializeRuntimeState`). Un champ
    // requis aurait rendu illisibles toutes les lignes deja en base.
    // `pending_request` (V3-B5) suit le meme principe : une ligne ecrite
    // avant ce champ reste lisible, la demande absente vaut `null`.
    expect(zRuntimeState.parse(ETAT_AVANT_INSPIRATION)).toEqual({
      ...ETAT_AVANT_INSPIRATION,
      inspiration: 0,
      pending_request: null,
      concentration: null,
      pact_slots_used: 0,
    });
  });

  it("relit une ligne ecrite AVANT la magie de pacte (V3.1-113) : aucun emplacement de pacte consomme", () => {
    expect(zRuntimeState.parse(ETAT_AVANT_INSPIRATION).pact_slots_used).toBe(0);
    expect(zRuntimeState.parse({ ...ETAT_AVANT_INSPIRATION, pact_slots_used: 2 }).pact_slots_used).toBe(2);
  });

  it("relit une ligne ecrite AVANT la concentration (V3.1-24) : le champ vaut null", () => {
    // Meme risque que pour l'inspiration : toutes les lignes deja en base
    // ont ete ecrites sans ce champ, et `parse` tourne a chaque ouverture de fiche.
    const ancienne = { ...ETAT_AVANT_INSPIRATION, inspiration: 1 };
    expect(zRuntimeState.parse(ancienne).concentration).toBeNull();
  });

  it("relit une concentration ecrite", () => {
    const state = { ...ETAT_AVANT_INSPIRATION, concentration: { spell_key: "bless", label: "Bénédiction" } };
    expect(zRuntimeState.parse(state).concentration).toEqual({ spell_key: "bless", label: "Bénédiction" });
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
