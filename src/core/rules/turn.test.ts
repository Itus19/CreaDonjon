import { describe, expect, it } from "vitest";
import { emptyScene, enterScene, type SceneState } from "./scene";
import { budgetForTurn } from "./actionBudget";
import { applyEffects, type TurnActor, type TurnState } from "./turn";

function actor(hp: number, max = 12): TurnActor {
  return { hp: { current: hp, max, temp: 0 }, conditions: [], resources: {}, budget: budgetForTurn(9) };
}

function stateWith(actors: Record<string, TurnActor>, scene?: SceneState): TurnState {
  let s = scene ?? emptyScene("ancre-rouillee");
  for (const id of Object.keys(actors)) s = enterScene(s, { entityId: id, zone: "engaged" });
  return { scene: s, actors };
}

describe("les points de vie d'un personnage joueur (jets contre la mort, V3.1-24)", () => {
  const pj = (hp: number, max = 12): TurnActor => ({ ...actor(hp, max), deathSaves: { success: 0, fail: 0 } });

  it("tomber a 0 PV rend Inconscient et le dit dans les changements", () => {
    const out = applyEffects(stateWith({ bram: pj(5) }), [{ action: "deal_damage", who: "bram", amount: 8 }]);
    expect(out.state.actors.bram.conditions).toContain("unconscious");
    expect(out.changes).toContainEqual({ kind: "condition", who: "bram", key: "unconscious", added: true });
  });

  it("des degats restants egaux aux PV max tuent sur le coup", () => {
    const out = applyEffects(stateWith({ bram: pj(5, 12) }), [{ action: "deal_damage", who: "bram", amount: 17 }]);
    expect(out.state.actors.bram.deathSaves).toEqual({ success: 0, fail: 3 });
  });

  it("un soin a 0 PV retire Inconscient et remet les jets a zero", () => {
    const down: TurnActor = { ...actor(0), conditions: ["unconscious"], deathSaves: { success: 1, fail: 2 } };
    const out = applyEffects(stateWith({ bram: down }), [{ action: "heal", who: "bram", amount: 3 }]);
    expect(out.state.actors.bram.hp.current).toBe(3);
    expect(out.state.actors.bram.conditions).toEqual([]);
    expect(out.state.actors.bram.deathSaves).toEqual({ success: 0, fail: 0 });
  });

  it("les PV temporaires sont toujours entames en premier", () => {
    const state = stateWith({ bram: { ...pj(9), hp: { current: 9, max: 12, temp: 4 } } });
    const out = applyEffects(state, [{ action: "deal_damage", who: "bram", amount: 6 }]);
    expect(out.state.actors.bram.hp).toEqual({ current: 7, max: 12, temp: 0 });
  });

  it("un acteur sans jets contre la mort (monstre) tombe a 0 sans Inconscient", () => {
    const out = applyEffects(stateWith({ gob: actor(3) }), [{ action: "deal_damage", who: "gob", amount: 11 }]);
    expect(out.state.actors.gob.conditions).toEqual([]);
  });
});

describe("les points de vie", () => {
  it("entame les points de vie temporaires AVANT les courants", () => {
    const state = stateWith({ bram: { ...actor(9), hp: { current: 9, max: 12, temp: 4 } } });
    const out = applyEffects(state, [{ action: "deal_damage", who: "bram", amount: 6, damage_type: "poison" }]);

    expect(out.state.actors.bram.hp).toEqual({ current: 7, max: 12, temp: 0 });
  });

  it("ne descend jamais sous zero", () => {
    const out = applyEffects(stateWith({ gob: actor(3) }), [{ action: "deal_damage", who: "gob", amount: 11 }]);
    expect(out.state.actors.gob.hp.current).toBe(0);
    expect(out.changes).toContainEqual(
      expect.objectContaining({ kind: "hp", who: "gob", note: expect.stringContaining("11") }),
    );
  });

  it("soigne sans depasser le maximum", () => {
    const out = applyEffects(stateWith({ bram: actor(9) }), [{ action: "heal", who: "bram", amount: 99 }]);
    expect(out.state.actors.bram.hp.current).toBe(12);
  });

  it("applique deux effets dans l'ordre recu, jamais en parallele", () => {
    const out = applyEffects(stateWith({ bram: actor(9) }), [
      { action: "deal_damage", who: "bram", amount: 9 },
      { action: "heal", who: "bram", amount: 4 },
    ]);
    expect(out.state.actors.bram.hp.current).toBe(4);
  });
});

describe("les conditions", () => {
  it("pose une condition, et ne la pose pas deux fois", () => {
    const once = applyEffects(stateWith({ bram: actor(9) }), [{ action: "apply_condition", who: "bram", key: "poisoned" }]);
    const twice = applyEffects(once.state, [{ action: "apply_condition", who: "bram", key: "poisoned" }]);

    expect(once.state.actors.bram.conditions).toEqual(["poisoned"]);
    expect(twice.state.actors.bram.conditions).toEqual(["poisoned"]);
    expect(twice.changes).toEqual([expect.objectContaining({ kind: "ignored", reason: expect.stringContaining("deja") })]);
  });

  it("retire une condition, et le dit quand il n'y avait rien a retirer", () => {
    const out = applyEffects(stateWith({ bram: actor(9) }), [{ action: "remove_condition", who: "bram", key: "prone" }]);
    expect(out.changes).toEqual([expect.objectContaining({ kind: "ignored" })]);
  });
});

describe("la scene", () => {
  it("deplace un acteur d'une zone a l'autre", () => {
    const out = applyEffects(stateWith({ gob: actor(7) }), [{ action: "move", who: "gob", zone: "far" }]);
    expect(out.state.scene.present.find((p) => p.entityId === "gob")?.zone).toBe("far");
    expect(out.changes).toContainEqual({ kind: "zone", who: "gob", from: "engaged", to: "far" });
  });

  it("ne leve JAMAIS sur un acteur absent : une regle maison ne fige pas une partie", () => {
    const state = stateWith({ bram: actor(9) });
    const out = applyEffects(state, [
      { action: "deal_damage", who: "fantome", amount: 5 },
      { action: "heal", who: "bram", amount: 2 },
    ]);

    // L'effet impossible est CONSIGNE, et les suivants s'appliquent quand meme.
    expect(out.changes[0]).toEqual(expect.objectContaining({ kind: "ignored", who: "fantome" }));
    expect(out.state.actors.bram.hp.current).toBe(11);
  });
});

describe("l'economie d'action", () => {
  it("accorde du budget, et en retire", () => {
    const out = applyEffects(stateWith({ bram: actor(9) }), [
      { action: "grant_budget", who: "bram", kind: "bonus", amount: 1 },
    ]);
    expect(out.state.actors.bram.budget.bonus).toBe(2);
  });

  it("laisse le budget passer en NEGATIF et le signale — signaler, ne pas interdire", () => {
    const out = applyEffects(stateWith({ bram: actor(9) }), [
      { action: "grant_budget", who: "bram", kind: "reaction", amount: -3 },
    ]);
    expect(out.state.actors.bram.budget.reaction).toBe(-2);
    expect(out.changes).toContainEqual(expect.objectContaining({ kind: "budget", overBudget: true }));
  });
});

describe("ce qui n'est PAS applicable l'est a voix haute", () => {
  it("refuse un modificateur durable, en disant pourquoi", () => {
    // V3-A6 a compte ce manque : « un effet qui dure » n'existe pas encore,
    // `entity_active_effects` n'est jamais ecrite. L'ignorer en silence
    // ferait croire a une regle appliquee.
    const out = applyEffects(stateWith({ bram: actor(9) }), [
      {
        action: "apply_modifier",
        who: "bram",
        modifier: { target: "ac", op: "add", value: 2, source: "rule:bouclier", label: "Bouclier", layer: 4 },
      },
    ]);
    expect(out.state.actors.bram.hp.current).toBe(9);
    expect(out.changes).toEqual([
      expect.objectContaining({ kind: "ignored", action: "apply_modifier", reason: expect.stringContaining("dure") }),
    ]);
  });

  it("garde les indices de narration a part : ce sont des mots, pas des mutations", () => {
    const out = applyEffects(stateWith({ bram: actor(9) }), [
      { action: "narrate_hint", text: "une fumee acre monte du sol" },
      { action: "roll", label: "Dés de rage", value: 4 },
      { action: "saving_throw", who: "bram", ability: "con", dc: 13, roll: 8, total: 10, passed: false },
    ]);

    expect(out.state.actors.bram.hp.current).toBe(9);
    expect(out.changes.map((c) => c.kind)).toEqual(["hint", "roll", "roll"]);
  });
});

describe("la purete", () => {
  it("ne mute jamais l'etat recu", () => {
    const state = stateWith({ bram: actor(9), gob: actor(7) });
    const avant = JSON.stringify(state);

    applyEffects(state, [
      { action: "deal_damage", who: "bram", amount: 4 },
      { action: "apply_condition", who: "gob", key: "prone" },
      { action: "move", who: "gob", zone: "near" },
    ]);

    expect(JSON.stringify(state)).toBe(avant);
  });
});
