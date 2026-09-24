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

  it("fusionne l'inspiration comme un compteur simple, zero compris", () => {
    // Zero doit passer : `??` et non `||`, sinon retirer la derniere
    // inspiration ne ferait rien — la faute classique sur un compteur qui
    // descend jusqu'a zero.
    const current = { ...defaultRuntimeState(), inspiration: 2 };
    expect(mergeRuntimeState(current, { inspiration: 0 }).inspiration).toBe(0);
    expect(mergeRuntimeState(current, {}).inspiration).toBe(2);
  });

  describe("V3-B5 — pending_request, ou pourquoi ce champ seul echappe a `??`", () => {
    const demande = {
      kind: "skill_check" as const,
      action_id: "athletics",
      target_id: null,
      target_label: null,
      advantage: "normal" as const,
      dc: 12,
      die_max: 20,
      modifier: 3,
      chips: [{ label: "Athlétisme", value: 3 }],
      what: "Athlétisme",
      actor_name: "Perrin",
      player_action_text: "j'escalade le mur",
      critical: false,
    };

    it("un patch qui ne mentionne pas pending_request le laisse INCHANGE", () => {
      const current = { ...defaultRuntimeState(), pending_request: demande };
      expect(mergeRuntimeState(current, { xp: 10 }).pending_request).toEqual(demande);
    });

    it("un patch { pending_request: null } EFFACE la demande — la difference avec `??` que ce champ existe pour couvrir", () => {
      const current = { ...defaultRuntimeState(), pending_request: demande };
      expect(mergeRuntimeState(current, { pending_request: null }).pending_request).toBeNull();
    });

    it("un patch { pending_request: <nouvelle demande> } REMPLACE l'ancienne — jamais un empilement", () => {
      const current = { ...defaultRuntimeState(), pending_request: demande };
      const autre = { ...demande, action_id: "stealth", what: "Discrétion" };
      expect(mergeRuntimeState(current, { pending_request: autre }).pending_request).toEqual(autre);
    });
  });
});
