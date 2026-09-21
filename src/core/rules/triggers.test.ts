import { describe, expect, it } from "vitest";
import type { Rng } from "../dice/rng";
import {
  TRIGGER_EVENTS,
  TRIGGER_LIMITS,
  runTriggers,
  zTrigger,
  type Trigger,
  type TriggerActorState,
  type TriggerContext,
} from "./triggers";

/** RNG deterministe : meme convention que `tables/roll.test.ts`, jamais Math.random(). */
function fixedRng(values: number[]): Rng {
  let i = 0;
  return { nextInt: () => values[i++ % values.length] };
}

function ctxWith(overrides: Partial<TriggerActorState> = {}): TriggerContext {
  return {
    actors: {
      self: {
        conditions: ["concentrating"],
        features: [],
        numbers: { "save.con": 3 },
        zone: "engaged",
        ...overrides,
      },
      attaquant: { conditions: [], features: [], numbers: {}, zone: "engaged" },
    },
  };
}

describe("vocabulaire ferme", () => {
  it("compte les 20 evenements du vocabulaire, ni plus ni moins", () => {
    // 18 a la spec §4, plus `check_passed`/`check_failed` (ADR 0028). C'est ce
    // nombre qui rend un ajout a la volee impossible : le changer exige un ADR.
    expect(TRIGGER_EVENTS).toHaveLength(20);
    expect(TRIGGER_EVENTS).toContain("damage_taken");
    expect(TRIGGER_EVENTS).toContain("dies");
  });

  it("refuse un evenement hors vocabulaire — un ajout passe par un ADR, jamais par la donnee", () => {
    const parsed = zTrigger.safeParse({
      id: "maison",
      when: { event: "le_joueur_eternue" },
      then: [{ action: "narrate_hint", text: "atchoum" }],
    });
    expect(parsed.success).toBe(false);
  });

  it("refuse plus de 8 effets sur un declencheur", () => {
    const parsed = zTrigger.safeParse({
      id: "trop",
      when: { event: "turn_start" },
      then: Array.from({ length: 9 }, () => ({ action: "narrate_hint", text: "x" })),
    });
    expect(parsed.success).toBe(false);
  });
});

/**
 * CAS DORE N° 1 (V3-A1) — la concentration rompue par les degats, exprimee
 * ENTIEREMENT en donnees. Aucune ligne de `triggers.ts` ne connait le mot
 * "concentration" : si ce test passe, le mecanisme est le bon.
 */
describe("cas dore 1 : la concentration, en donnees seulement", () => {
  const concentration: Trigger = {
    id: "concentration",
    when: { event: "damage_taken", subject: "self" },
    if: {
      op: "and",
      args: [
        { op: "has_condition", who: "self", key: "concentrating" },
        { op: "gte", args: [{ op: "ref", name: "event.damage" }, { op: "num", value: 1 }] },
      ],
    },
    then: [
      {
        action: "saving_throw",
        who: "self",
        ability: "con",
        dc: {
          op: "max",
          args: [
            { op: "num", value: 10 },
            {
              op: "floor",
              args: [{ op: "div", args: [{ op: "ref", name: "event.damage" }, { op: "num", value: 2 }] }],
            },
          ],
        },
        on_fail: [{ action: "remove_condition", who: "self", key: "concentrating" }],
      },
    ],
  };

  it("est une donnee valide", () => {
    expect(zTrigger.safeParse(concentration).success).toBe(true);
  });

  it("22 degats -> DD 11 ; un jet rate retire la concentration", () => {
    // nextInt(20) = 1 -> d20 = 2 ; 2 + 3 (save.con) = 5 < 11.
    const out = runTriggers({
      event: { event: "damage_taken", subject: "self", data: { "event.damage": 22 } },
      triggers: [concentration],
      ctx: ctxWith(),
      rng: fixedRng([1]),
    });
    expect(out.error).toBeUndefined();
    expect(out.effects.find((e) => e.action === "saving_throw")).toMatchObject({ dc: 11, passed: false });
    expect(out.effects).toContainEqual(
      expect.objectContaining({ action: "remove_condition", key: "concentrating" }),
    );
  });

  it("un jet reussi ne retire rien", () => {
    // nextInt(20) = 19 -> d20 = 20 ; 20 + 3 = 23 >= 11.
    const out = runTriggers({
      event: { event: "damage_taken", subject: "self", data: { "event.damage": 22 } },
      triggers: [concentration],
      ctx: ctxWith(),
      rng: fixedRng([19]),
    });
    expect(out.effects.find((e) => e.action === "saving_throw")).toMatchObject({ passed: true });
    expect(out.effects.some((e) => e.action === "remove_condition")).toBe(false);
  });

  it("sans la condition `concentrating`, le declencheur ne part pas du tout", () => {
    const out = runTriggers({
      event: { event: "damage_taken", subject: "self", data: { "event.damage": 22 } },
      triggers: [concentration],
      ctx: ctxWith({ conditions: [] }),
      rng: fixedRng([1]),
    });
    expect(out.effects).toHaveLength(0);
  });

  it("0 degat ne rompt pas la concentration (la borne `gte 1` du cas reel)", () => {
    const out = runTriggers({
      event: { event: "damage_taken", subject: "self", data: { "event.damage": 0 } },
      triggers: [concentration],
      ctx: ctxWith(),
      rng: fixedRng([1]),
    });
    expect(out.effects).toHaveLength(0);
  });
});

/**
 * CAS DORE N° 2 (V3-A1) — deux declencheurs qui se repondent s'arretent a la
 * profondeur 4 avec une erreur EXPLICITE, jamais une boucle. C'est la
 * propriete que Lua ne pouvait pas offrir (specs/moteur-de-jeu.md §3).
 */
describe("cas dore 2 : deux declencheurs qui se repondent", () => {
  const pingPong: Trigger[] = [
    {
      id: "ping",
      when: { event: "damage_taken", subject: "self" },
      then: [{ action: "deal_damage", who: "self", amount: { op: "num", value: 1 } }],
    },
    {
      id: "pong",
      when: { event: "damage_taken", subject: "self" },
      then: [{ action: "deal_damage", who: "self", amount: { op: "num", value: 1 } }],
    },
  ];

  it("s'arrete, et le dit", () => {
    const out = runTriggers({
      event: { event: "damage_taken", subject: "self", data: { "event.damage": 1 } },
      triggers: pingPong,
      ctx: ctxWith(),
      rng: fixedRng([10]),
    });
    expect(out.error?.code).toBe("chain_depth_exceeded");
    expect(out.error?.message).toContain(String(TRIGGER_LIMITS.maxChainDepth));
  });

  it("ne boucle pas : le nombre d'effets reste borne", () => {
    const out = runTriggers({
      event: { event: "damage_taken", subject: "self", data: { "event.damage": 1 } },
      triggers: pingPong,
      ctx: ctxWith(),
      rng: fixedRng([10]),
    });
    // Borne lache mais suffisante : ce qui compte est que ca TERMINE et reste fini.
    expect(out.effects.length).toBeLessThanOrEqual(64);
  });

  it("rejette au-dela de 32 declencheurs sur un meme evenement", () => {
    const foule: Trigger[] = Array.from({ length: 33 }, (_, i) => ({
      id: `t${i}`,
      when: { event: "turn_start" as const },
      then: [{ action: "narrate_hint" as const, text: "x" }],
    }));
    const out = runTriggers({
      event: { event: "turn_start", subject: "self" },
      triggers: foule,
      ctx: ctxWith(),
      rng: fixedRng([10]),
    });
    expect(out.error?.code).toBe("too_many_triggers");
  });
});

describe("ordre d'execution", () => {
  it("priorite decroissante, puis ordre de declaration a egalite", () => {
    const t = (id: string, priority?: number): Trigger => ({
      id,
      when: { event: "turn_start" },
      priority,
      then: [{ action: "narrate_hint", text: id }],
    });
    const out = runTriggers({
      event: { event: "turn_start", subject: "self" },
      triggers: [t("a"), t("haut", 10), t("b"), t("bas", -5)],
      ctx: ctxWith(),
      rng: fixedRng([10]),
    });
    expect(out.effects.map((e) => (e.action === "narrate_hint" ? e.text : ""))).toEqual([
      "haut",
      "a",
      "b",
      "bas",
    ]);
  });
});

describe("in_range : trois zones abstraites, pas de grille", () => {
  const aura: Trigger = {
    id: "aura",
    when: { event: "turn_start", subject: "self" },
    if: { op: "in_range", who: "self", of: "attaquant", zone: "near" },
    then: [
      {
        action: "apply_modifier",
        who: "attaquant",
        modifier: {
          target: "save.con",
          op: "add",
          value: 2,
          source: "trigger:aura",
          label: "Aura",
          layer: 4,
        },
      },
    ],
  };

  it("s'applique quand les deux sont dans la bande", () => {
    const out = runTriggers({
      event: { event: "turn_start", subject: "self" },
      triggers: [aura],
      ctx: ctxWith(),
      rng: fixedRng([10]),
    });
    expect(out.effects).toHaveLength(1);
  });

  it("ne s'applique pas quand l'un est trop loin", () => {
    const base = ctxWith();
    const out = runTriggers({
      event: { event: "turn_start", subject: "self" },
      triggers: [aura],
      ctx: { actors: { ...base.actors, attaquant: { ...base.actors.attaquant, zone: "far" } } },
      rng: fixedRng([10]),
    });
    expect(out.effects).toHaveLength(0);
  });
});

/**
 * ADR 0029 — la Fougue du guerrier, ecrite en donnees : une aptitude qui
 * accorde une action bonus. Sans cet effet, le critere de V3-A3 « un
 * declencheur peut accorder ou retirer du budget » restait du texte.
 */
describe("grant_budget", () => {
  const fougue: Trigger = {
    id: "fougue",
    when: { event: "turn_start", subject: "self" },
    then: [{ action: "grant_budget", who: "self", kind: "bonus", amount: { op: "num", value: 1 } }],
  };

  it("est une donnee valide, et resout son montant", () => {
    expect(zTrigger.safeParse(fougue).success).toBe(true);
    const out = runTriggers({
      event: { event: "turn_start", subject: "self" },
      triggers: [fougue],
      ctx: ctxWith(),
      rng: fixedRng([10]),
    });
    expect(out.effects).toEqual([{ action: "grant_budget", who: "self", kind: "bonus", amount: 1 }]);
  });

  it("retire avec un montant negatif — un seul effet pour les deux sens", () => {
    const prive: Trigger = {
      ...fougue,
      id: "prive-de-reaction",
      then: [{ action: "grant_budget", who: "self", kind: "reaction", amount: { op: "num", value: -1 } }],
    };
    const out = runTriggers({
      event: { event: "turn_start", subject: "self" },
      triggers: [prive],
      ctx: ctxWith(),
      rng: fixedRng([10]),
    });
    expect(out.effects[0]).toMatchObject({ action: "grant_budget", amount: -1 });
  });

  it("refuse une categorie de budget inventee", () => {
    expect(
      zTrigger.safeParse({
        ...fougue,
        then: [{ action: "grant_budget", who: "self", kind: "telepathie", amount: { op: "num", value: 1 } }],
      }).success,
    ).toBe(false);
  });
});
