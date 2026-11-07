import { describe, expect, it } from "vitest";
import { activeEffectsForSheet, consumeToken, effectFromRow, effectToRow, expireEffects, instantiateDurableEffect, type ActiveDurableEffect } from "./durableEffects";
import type { DurableEffect } from "../schemas/rule-blocks/playable";

/**
 * V3.1-129 (ADR 0060 §3) — les effets qui durent. L'expiration est une
 * fonction pure : on lui donne un événement, elle rend ce qui reste et ce
 * qui part, avec la raison. Un effet retiré n'est jamais retiré en silence.
 */

const EFFRAYE: DurableEffect = {
  id: "frightened-abjure",
  label: { fr: "Effrayé (Abjuration)" },
  conditions: ["frightened"],
  modifiers: [],
  duration: { unit: "minute", amount: 1 },
  concentration: false,
  ends_on: [{ event: "damage_taken", subject: "bearer" }],
  token: null,
};

const effraye = (bearer = "g1"): ActiveDurableEffect =>
  instantiateDurableEffect(EFFRAYE, { bearer, source: "paladin", activationId: "abjure", round: 1, currentTurn: "paladin" });

describe("Effrayé d'Abjuration d'ennemis", () => {
  it("disparaît dès que son porteur subit des dégâts", () => {
    const r = expireEffects([effraye("g1"), effraye("g2")], { kind: "game_event", event: "damage_taken", subject: "g1" });
    expect(r.kept.map((e) => e.bearer)).toEqual(["g2"]);
    expect(r.expired).toEqual([{ effect: expect.objectContaining({ bearer: "g1" }), reason: "ends_on:damage_taken" }]);
  });

  it("des dégâts subis par la SOURCE ne le retirent pas", () => {
    expect(expireEffects([effraye()], { kind: "game_event", event: "damage_taken", subject: "paladin" }).expired).toEqual([]);
  });

  it("dure 10 rounds sinon : décompté au début du tour de la source, retiré au dixième", () => {
    let effets = [effraye()];
    for (let round = 2; round <= 10; round++) {
      const r = expireEffects(effets, { kind: "turn_start", actor: "paladin" });
      expect(r.expired).toEqual([]);
      effets = r.kept;
    }
    const fin = expireEffects(effets, { kind: "turn_start", actor: "paladin" });
    expect(fin.kept).toEqual([]);
    expect(fin.expired[0].reason).toBe("duration");
  });

  it("le début du tour d'un autre ne décompte rien", () => {
    const r = expireEffects([effraye()], { kind: "turn_start", actor: "g1" });
    expect(r.kept[0].remainingRounds).toBe(10);
  });

  it("hors combat, l'avance du temps décompte en minutes (1 minute = 10 rounds)", () => {
    expect(expireEffects([effraye()], { kind: "time", minutes: 1 }).expired).toHaveLength(1);
    expect(expireEffects([effraye()], { kind: "time", minutes: 0.5 }).kept[0].remainingRounds).toBe(5);
  });
});

describe("autres durées et fins", () => {
  const fx = (d: Partial<DurableEffect>, ctx = { currentTurn: "paladin" }) =>
    instantiateDurableEffect({ ...EFFRAYE, ends_on: [], ...d }, { bearer: "allie", source: "paladin", activationId: "a", round: 1, currentTurn: ctx.currentTurn });

  it("« jusqu'à la fin de votre prochain tour », posé pendant ce tour : survit à la fin du tour courant", () => {
    const e = fx({ duration: { unit: "until_turn_end", whose: "source", which: "next" } });
    const r1 = expireEffects([e], { kind: "turn_end", actor: "paladin" });
    expect(r1.kept).toHaveLength(1);
    expect(expireEffects(r1.kept, { kind: "turn_end", actor: "paladin" }).expired[0].reason).toBe("duration");
  });

  it("« jusqu'à la fin du tour » du porteur, posé hors de son tour : part à la fin de son prochain tour", () => {
    const e = fx({ duration: { unit: "until_turn_end", whose: "bearer", which: "current" } });
    expect(expireEffects([e], { kind: "turn_end", actor: "paladin" }).kept).toHaveLength(1);
    expect(expireEffects([e], { kind: "turn_end", actor: "allie" }).expired).toHaveLength(1);
  });

  it("« jusqu'au repos » : un repos court ou long le retire ; « permanent » jamais par le temps", () => {
    expect(expireEffects([fx({ duration: { unit: "until_rest" } })], { kind: "rest", rest: "short" }).expired[0].reason).toBe("rest");
    const p = fx({ duration: { unit: "permanent" } });
    expect(expireEffects([p], { kind: "time", minutes: 100000 }).kept).toHaveLength(1);
    expect(expireEffects([p], { kind: "rest", rest: "long" }).kept).toHaveLength(1);
  });

  it("un repos fait avancer le temps (court : 1 h, long : 8 h) : un effet de 2 h survit au court, pas au long", () => {
    const h = fx({ duration: { unit: "hour", amount: 2 } });
    expect(expireEffects([h], { kind: "rest", rest: "long" }).expired[0].reason).toBe("duration");
    const court = expireEffects([h], { kind: "rest", rest: "short" });
    expect(court.kept).toHaveLength(1);
    expect(court.kept[0].remainingRounds).toBe(600);
  });

  it("concentration rompue par la source : l'effet lié part ; un autre lanceur ne touche à rien", () => {
    const c = fx({ concentration: true, duration: { unit: "minute", amount: 10 } });
    expect(expireEffects([c], { kind: "concentration_broken", source: "autre" }).kept).toHaveLength(1);
    expect(expireEffects([c], { kind: "concentration_broken", source: "paladin" }).expired[0].reason).toBe("concentration");
  });

  it("« au choix » : seul le porteur ou la source peut y mettre fin", () => {
    const d = fx({ ends_on: [{ event: "dismissed" }], duration: { unit: "hour", amount: 1 } });
    expect(expireEffects([d], { kind: "dismissed", by: "g9", effectInstanceId: d.instanceId }).kept).toHaveLength(1);
    expect(expireEffects([d], { kind: "dismissed", by: "allie", effectInstanceId: d.instanceId }).expired[0].reason).toBe("dismissed");
  });
});

describe("jetons (ADR 0060 §3)", () => {
  const jeton = instantiateDurableEffect(
    { ...EFFRAYE, id: "edge", label: { fr: "Avantage à un jet" }, conditions: [], ends_on: [], duration: { unit: "hour", amount: 1 }, token: { uses: 1, grants: "use-edge" } },
    { bearer: "allie", source: "barde", activationId: "inspire", round: null, currentTurn: null },
  );

  it("« avantage à un jet de votre choix » s'engage une fois puis disparaît", () => {
    const r = consumeToken([jeton], { instanceId: jeton.instanceId, by: "allie" });
    if (!r.ok) throw new Error(r.reason);
    expect(r.grants).toBe("use-edge");
    expect(r.kept).toEqual([]);
    expect(r.expired).toEqual([{ effect: jeton, reason: "token_used" }]);
    expect(consumeToken(r.kept, { instanceId: jeton.instanceId, by: "allie" })).toEqual({ ok: false, reason: "no_token" });
  });

  it("un jeton à deux usages reste après le premier", () => {
    const deux = { ...jeton, tokenUsesLeft: 2 };
    const r = consumeToken([deux], { instanceId: jeton.instanceId, by: "allie" });
    if (!r.ok) throw new Error(r.reason);
    expect(r.kept[0].tokenUsesLeft).toBe(1);
    expect(r.expired).toEqual([]);
  });

  it("seul le porteur engage son jeton", () => {
    expect(consumeToken([jeton], { instanceId: jeton.instanceId, by: "barde" })).toEqual({ ok: false, reason: "not_bearer" });
  });
});

describe("activeEffectsForSheet — la couche 7 de la fiche", () => {
  it("les modificateurs déclarés d'un effet porté deviennent des modificateurs de couche 7, ceux des autres porteurs non", () => {
    const beni = instantiateDurableEffect(
      { ...EFFRAYE, id: "bless", label: { fr: "Bénédiction" }, conditions: [], modifiers: [{ target: "save.wis", op: "add", value: 2 }] },
      { bearer: "allie", source: "clerc", activationId: "bless", round: 1, currentTurn: "clerc" },
    );
    expect(activeEffectsForSheet([beni, effraye("g1")], "allie")).toEqual([
      { key: beni.instanceId, label: "Bénédiction", modifiers: [{ target: "save.wis", op: "add", value: 2, source: `effect:${beni.instanceId}`, label: "Bénédiction", layer: 7 }] },
    ]);
  });
});

describe("forme stockée (V3.1-130, ADR 0073)", () => {
  it("un effet passe en ligne et revient identique, l'identifiant de la ligne devenant celui de l'instance", () => {
    const e = { ...effraye("g1"), tokenGrants: null };
    const ligne = effectToRow(e, "channel-divinity-paladin");
    expect(ligne.source_key).toBe("channel-divinity-paladin");
    const relu = effectFromRow({ id: "row-1", ...ligne }, "g1");
    // V3.1-158 : la relecture garde aussi la règle qui l'a posé.
    expect(relu).toEqual({ ...e, instanceId: "row-1", ruleKey: "channel-divinity-paladin" });
  });

  it("une ligne mal formée est écartée (null), jamais devinée", () => {
    expect(effectFromRow({ id: "x", label: "X", modifiers: [], duration: {}, payload: {} }, "g1")).toBeNull();
  });
});
