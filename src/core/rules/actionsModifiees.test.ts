import { describe, expect, it } from "vitest";
import { characterSheet, resolveDeclaredModifiers, type CharacterBuild, type DeclaredModifier, type ResolvedRuleset } from "./sheet";
import { applyCastOption, budgetForTurn, grantTurnBudget, ownTurnStamp, spendTurnBudget, EMPTY_TURN_BUDGET } from "./turnBudget";
import { planActivation } from "./activation";
import { zActivationBlockData, type ActivationBlockData } from "../schemas/rule-blocks/playable";
import { parseFormula } from "../formula";
import type { TriggerContext } from "./triggers";

/**
 * V3.1-164 (ADR 0076) — les actions modifiées, en fonctions pures : attaques
 * par action, actions permises en action bonus, budget du tour compté sans
 * écriture au passage de tour, coût en emplacement (`slot.level`), coût
 * « une attaque », options de lancement (Sort accéléré).
 */

const f = (t: string) => parseFormula(t);

const ruleset = (features: Record<string, DeclaredModifier[]>): ResolvedRuleset => ({
  classes: { fighter: { key: "fighter", label: "Guerrier", hitDie: 10, savingThrowProficiencies: ["str", "con"] } },
  features: Object.fromEntries(Object.entries(features).map(([key, m]) => [key, { key, label: key, source: "class:fighter", modifiers: resolveDeclaredModifiers(m, key, key, 3) }])),
});
const build = (featureKeys: string[]): CharacterBuild => ({
  species: "human",
  classes: [{ key: "fighter", level: 5 }],
  abilities: { assigned: { str: 16, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } },
  featureKeys,
});

describe("la fiche : attaques par action, actions en action bonus", () => {
  it("une attaque par défaut ; Attaque supplémentaire en donne deux, la plus haute l'emporte (11 : trois)", () => {
    expect(characterSheet(build([]), ruleset({}), [], []).attacksPerAction).toBe(1);
    const rs = ruleset({ extra: [{ target: "attacks_per_action", op: "set", value: 2 }], extra11: [{ target: "attacks_per_action", op: "set", value: 3 }] });
    expect(characterSheet(build(["extra"]), rs, [], []).attacksPerAction).toBe(2);
    expect(characterSheet(build(["extra", "extra11"]), rs, [], []).attacksPerAction).toBe(3);
  });

  it("Action rusée : Foncer, Se désengager, Se cacher deviennent des actions bonus", () => {
    const rs = ruleset({ ruse: ["dash", "disengage", "hide"].map((a) => ({ target: `action_as_bonus.${a}`, op: "set" as const, value: 1 })) });
    expect(characterSheet(build(["ruse"]), rs, [], []).bonusActionOptions).toEqual(["dash", "disengage", "hide"]);
    expect(characterSheet(build([]), rs, [], []).bonusActionOptions).toEqual([]);
  });
});

describe("le budget du tour (compté en combat, sans écriture au passage de tour)", () => {
  it("la date du dernier tour du participant : son tour du round, ou celui du round d'avant", () => {
    expect(ownTurnStamp({ round: 2, turnIndex: 3 }, 1)).toBe("2:1");
    expect(ownTurnStamp({ round: 2, turnIndex: 0 }, 1)).toBe("1:1");
  });

  it("neuf quand son tour a changé, repris sinon", () => {
    expect(budgetForTurn({ ...EMPTY_TURN_BUDGET, at: "1:1", action: 0 }, "2:1")).toEqual({ at: "2:1", action: 1, bonus: 1, attacks: 0, extraNotMagic: 0 });
    expect(budgetForTurn({ at: "2:1", action: 0, bonus: 1, attacks: 1, extraNotMagic: 0 }, "2:1").attacks).toBe(1);
    expect(budgetForTurn(undefined, "2:1").action).toBe(1);
  });

  it("Attaque supplémentaire : la première attaque ouvre l'action Attaque, la deuxième est comprise, la troisième dépasse", () => {
    let b = budgetForTurn(undefined, "1:0");
    let r = spendTurnBudget(b, "attack", 2);
    expect(r).toMatchObject({ over: false, budget: { action: 0, attacks: 1 } });
    r = spendTurnBudget(r.budget, "attack", 2);
    expect(r).toMatchObject({ over: false, budget: { action: 0, attacks: 0 } });
    r = spendTurnBudget(r.budget, "attack", 2);
    expect(r.over).toBe(true);
    b = r.budget;
    expect(b.action).toBe(-1);
  });

  it("Sursaut d'action : une action de plus, mais pas pour l'action Magie", () => {
    const b = grantTurnBudget(spendTurnBudget(budgetForTurn(undefined, "1:0"), "action", 1).budget, { kind: "action", amount: 1, notMagic: true });
    expect(spendTurnBudget(b, "magic", 1).over).toBe(true);
    expect(spendTurnBudget(b, "action", 1)).toMatchObject({ over: false, budget: { extraNotMagic: 0 } });
    expect(spendTurnBudget(b, "attack", 2)).toMatchObject({ over: false, budget: { extraNotMagic: 0, attacks: 1 } });
  });

  it("une action bonus se compte à part ; « aucun » et « gratuit » ne coûtent rien", () => {
    const b = budgetForTurn(undefined, "1:0");
    expect(spendTurnBudget(b, "bonus", 1)).toMatchObject({ over: false, budget: { bonus: 0, action: 1 } });
    expect(spendTurnBudget(b, "none", 1).budget).toEqual(b);
    expect(spendTurnBudget(b, "free", 1).budget).toEqual(b);
  });
});

describe("le compte de la réaction garde le budget", () => {
  it("recordUse ne perd pas le budget du tour", async () => {
    const { recordUse, EMPTY_TURN_USAGE } = await import("./rollWindow");
    const budget = { at: "1:0", action: 0, bonus: 1, attacks: 1, extraNotMagic: 0 };
    expect(recordUse({ ...EMPTY_TURN_USAGE, budget }, { key: null, reaction: true, stamp: "1:2" }).budget).toEqual(budget);
  });
});

describe("les options de lancement", () => {
  it("Sort accéléré : le temps d'incantation passe à l'action bonus, et l'option ajoute son coût", () => {
    const cost = { action: "magic" as const, resources: [], slot: { level: 1 } };
    const r = applyCastOption(cost, { id: "quickened", label: { fr: "Sort accéléré" }, cost: { resources: [{ key: "sorcery-points", amount: f("2") }] }, changes: { action: "bonus" } });
    expect(r).toEqual({ action: "bonus", resources: [{ key: "sorcery-points", amount: f("2") }], slot: { level: 1 } });
  });
});

const BENEDICTION: ActivationBlockData = zActivationBlockData.parse({
  activations: [
    {
      id: "bless",
      label: { fr: "Bénédiction" },
      cost: { action: "magic", resources: [], slot: { level: 1 } },
      targets: { kind: "ally", count: f("3 + {slot.level} - 1") },
      effects: [{ action: "apply_effect", who: "target", effect: "blessed" }],
      variants: null,
    },
  ],
  durable_effects: [
    { id: "blessed", label: { fr: "Béni" }, conditions: [], modifiers: [{ target: "attack", op: "add", value: f("1d4") }], duration: { unit: "minute", amount: 1 }, concentration: true, ends_on: [], token: null },
  ],
});
const acteurs = (n: number): TriggerContext => ({
  actors: Object.fromEntries([["clerc", { conditions: [], features: [], numbers: {} }], ...Array.from({ length: n }, (_, i) => [`a${i}`, { conditions: [], features: [], numbers: {} }])]),
});
const plan = (slotLevel: number | null, cibles: number) =>
  planActivation({
    block: BENEDICTION, activationId: "bless", actorId: "clerc", targetIds: Array.from({ length: cibles }, (_, i) => `a${i}`),
    ctx: acteurs(cibles), resources: [], used: {}, budget: null, currentTurn: null, round: null, rng: { nextInt: () => 0 }, ...(slotLevel !== null ? { slotLevel } : {}),
  });

describe("coût en emplacement : `slot.level` dans les formules", () => {
  it("Bénédiction au niveau 1 : trois cibles ; au niveau 2 : quatre ; une cinquième est refusée", () => {
    expect(plan(1, 3).ok).toBe(true);
    expect(plan(1, 4)).toMatchObject({ ok: false, reason: "too_many_targets" });
    expect(plan(2, 4).ok).toBe(true);
    expect(plan(2, 5)).toMatchObject({ ok: false, reason: "too_many_targets" });
  });

  it("un emplacement trop bas, ou aucun emplacement pour un sort qui en demande : refusé, sans dé lancé", () => {
    expect(plan(0, 1)).toMatchObject({ ok: false, reason: "slot_too_low" });
    expect(plan(null, 1)).toMatchObject({ ok: false, reason: "slot_too_low" });
  });
});

describe("le schéma", () => {
  it("accepte le coût « une attaque », les options de lancement et l'effet « lancer un sort »", () => {
    const r = zActivationBlockData.safeParse({
      activations: [
        { id: "souffle", label: { fr: "Souffle" }, cost: { action: "attack", resources: [] }, targets: { kind: "self" }, effects: [], variants: null },
        {
          id: "metamagie", label: { fr: "Métamagie" }, cost: { action: "none", resources: [] }, targets: { kind: "self" }, effects: [], variants: null,
          cast_options: [{ id: "quickened", label: { fr: "Sort accéléré" }, cost: { resources: [{ key: "sorcery-points", amount: f("2") }] }, changes: { action: "bonus" } }],
        },
        { id: "compagnon", label: { fr: "Compagnon sauvage" }, cost: { action: "magic", resources: [] }, targets: { kind: "self" }, effects: [{ action: "cast_spell", who: "self", spell: "find-familiar", free: true }], variants: null },
      ],
      durable_effects: [],
    });
    expect(r.success).toBe(true);
  });
});
