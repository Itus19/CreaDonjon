import { describe, expect, it } from "vitest";
import { formStats, type BaseStats } from "./forms";
import { planActivation } from "./activation";
import { resolveEffectList, type TriggerContext } from "./triggers";
import { applyEffects, type TurnState } from "./turn";
import { applyRollOperations, type PendingRoll } from "./rollWindow";
import { zActivationBlockData, zRollOperation } from "../schemas/rule-blocks/playable";
import { parseFormula } from "../formula";

/**
 * V3.1-182 (ADR 0078) — les formes (Forme sauvage, Métamorphose), les
 * invocations, et les cas uniques : quantité choisie (Imposition des mains),
 * regain d'une ressource, consommable, redirection d'une attaque. Pur.
 */

const f = (s: string) => parseFormula(s);
const rng = { nextInt: () => 0 };

describe("formStats : le profil d'une forme", () => {
  const druide: BaseStats = { ac: 14, speed: 9, abilities: { str: 10, dex: 14, con: 12, int: 12, wis: 16, cha: 10 } };
  const loup = { ac: 12, speed: 12, abilities: { str: 12, dex: 15, con: 12, int: 3, wis: 12, cha: 6 } };

  it("overlay (Forme sauvage) : CA, vitesse, FOR, DEX, CON de la bête ; INT, SAG, CHA du druide", () => {
    expect(formStats(druide, loup, "overlay")).toEqual({ ac: 12, speed: 12, abilities: { str: 12, dex: 15, con: 12, int: 12, wis: 16, cha: 10 } });
  });

  it("replace (Métamorphose) : les six caractéristiques de la bête", () => {
    expect(formStats(druide, loup, "replace").abilities).toEqual(loup.abilities);
  });
});

describe("les effets nouveaux : se transformer, invoquer, regagner", () => {
  const ctx: TriggerContext = { actors: { druide: { conditions: [], features: [], numbers: { "class.level": 4, proficiency: 2 } } } };
  const fired = { event: "turn_start" as const, subject: "druide" };

  it("transform et summon se résolvent tels quels (le service les joue) ; le nombre de créatures se calcule", () => {
    const r = resolveEffectList(
      [
        { action: "transform", who: "druide", form: "wolf", mode: "overlay" },
        { action: "summon", who: "druide", creature: "owl", count: f("1 + 1") },
        { action: "temp_hp", who: "druide", amount: f("{class.level}") },
      ],
      ctx,
      fired,
      rng,
    );
    expect(r).toEqual([
      { action: "transform", who: "druide", form: "wolf", mode: "overlay" },
      { action: "summon", who: "druide", creature: "owl", count: 2 },
      { action: "temp_hp", who: "druide", amount: 4 },
    ]);
  });

  it("restore_resource : une recharge sur événement (Rage persistante) ; « all » regagne tout", () => {
    expect(resolveEffectList([{ action: "restore_resource", who: "druide", key: "rage", amount: f("2") }], ctx, fired, rng)).toEqual([{ action: "restore_resource", who: "druide", key: "rage", amount: 2 }]);
    expect(resolveEffectList([{ action: "restore_resource", who: "druide", key: "rage", all: true }], ctx, fired, rng)).toEqual([{ action: "restore_resource", who: "druide", key: "rage", all: true }]);
  });

  it("le tour ne joue ni forme ni invocation : il le dit, sans rien changer", () => {
    const etat: TurnState = { scene: { __v: 4, locationId: "x", present: [], time: { day: 1, hour: 8, minute: 0 }, lighting: "bright", zones: {}, budgets: {} } as unknown as TurnState["scene"], actors: {} };
    const r = applyEffects(etat, [{ action: "transform", who: "druide", form: "wolf", mode: "overlay" }]);
    expect(r.changes[0]).toMatchObject({ kind: "ignored", action: "transform" });
  });
});

describe("une quantité choisie (Imposition des mains)", () => {
  const imposition = zActivationBlockData.parse({
    activations: [
      {
        id: "lay-on-hands",
        label: { fr: "Imposition des mains" },
        cost: { action: "bonus", resources: [{ key: "lay-on-hands", amount: f("{amount}") }] },
        amount: { max: f("5 * {class.level}") },
        targets: { kind: "self" },
        effects: [{ action: "heal", who: "self", amount: f("{amount}") }],
        variants: null,
      },
    ],
  });
  const plan = (amount: number | undefined, used = 0) =>
    planActivation({
      block: imposition, activationId: "lay-on-hands", actorId: "pal", targetIds: [],
      ctx: { actors: { pal: { conditions: [], features: [], numbers: { "class.level": 2 } } } },
      resources: [{ key: "lay-on-hands", max: 10 }],
      used: { "lay-on-hands": used }, budget: null, currentTurn: null, round: null, rng,
      ...(amount !== undefined ? { amount } : {}),
    });

  it("soigne et dépense le montant choisi", () => {
    const r = plan(7);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.plan.used["lay-on-hands"]).toBe(7);
      expect(r.plan.effects).toContainEqual({ action: "heal", who: "pal", amount: 7 });
    }
  });

  it("borné : rien choisi, zéro, ou plus que le maximum, c'est refusé ; plus que la réserve aussi", () => {
    expect(plan(undefined)).toMatchObject({ ok: false, reason: "amount_out_of_range" });
    expect(plan(0)).toMatchObject({ ok: false, reason: "amount_out_of_range" });
    expect(plan(11)).toMatchObject({ ok: false, reason: "amount_out_of_range" });
    expect(plan(5, 7)).toMatchObject({ ok: false, reason: "not_enough_resource" });
  });
});

describe("un consommable, et la redirection d'une attaque", () => {
  it("le coût « consommer un objet » se déclare et le plan le rend", () => {
    const bloc = zActivationBlockData.parse({
      activations: [{ id: "fiole", label: { fr: "Fiole" }, cost: { action: "action", resources: [], consume_item: { key: "blinding-powder", count: 1 } }, targets: { kind: "self" }, effects: [], variants: null }],
    });
    const r = planActivation({ block: bloc, activationId: "fiole", actorId: "a", targetIds: [], ctx: { actors: { a: { conditions: [], features: [], numbers: {} } } }, resources: [], used: {}, budget: null, currentTurn: null, round: null, rng });
    expect(r.ok && r.plan.consume).toEqual({ key: "blinding-powder", count: 1 });
  });

  it("redirect : l'attaque vise désormais celui qui réagit", () => {
    expect(zRollOperation.safeParse({ op: "redirect" }).success).toBe(true);
    const roll: PendingRoll = { kind: "attack", roller: "gob", target: "lia", natural: 12, total: 17, critRange: 20, ac: 15, dc: null, acBonus: 0, damage: null };
    const r = applyRollOperations(roll, [{ actorId: "gardien", operations: [{ op: "redirect" }], numbers: {} }], rng);
    expect(r.roll.target).toBe("gardien");
    expect(r.steps[0]).toMatchObject({ actorId: "gardien", op: "redirect" });
  });
});
