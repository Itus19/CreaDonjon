import { describe, expect, it } from "vitest";
import { defaultRuntimeState } from "../schemas/runtimeState";
import { mergeRuntimeState } from "./runtimeState";

describe("mergeRuntimeState", () => {
  it("ecrit le plus petit fait possible : un patch partiel ne touche pas le reste (specs/wiki-blocs.md §4.5)", () => {
    const current = {
      ...defaultRuntimeState(),
      hp: { current: 12, temp: 0 },
      xp: 300,
      conditions: ["prone"],
    };
    const next = mergeRuntimeState(current, { hp: { current: 9 } });
    expect(next.hp).toEqual({ current: 9, temp: 0 });
    expect(next.xp).toBe(300);
    expect(next.conditions).toEqual(["prone"]);
  });

  it("fusionne les compteurs cle par cle (resources, hit_dice, spell_slots_used)", () => {
    const current = {
      ...defaultRuntimeState(),
      resources: { r1: 1, r2: 5 },
    };
    const next = mergeRuntimeState(current, { resources: { r1: 2 } });
    expect(next.resources).toEqual({ r1: 2, r2: 5 });
  });

  it("remplace integralement les listes (conditions, attuned) plutot que de les fusionner", () => {
    const current = { ...defaultRuntimeState(), conditions: ["prone", "poisoned"] };
    const next = mergeRuntimeState(current, { conditions: ["prone"] });
    expect(next.conditions).toEqual(["prone"]);
  });

  it("un patch vide laisse l'etat inchange", () => {
    const current = { ...defaultRuntimeState(), xp: 50 };
    expect(mergeRuntimeState(current, {})).toEqual(current);
  });
});
