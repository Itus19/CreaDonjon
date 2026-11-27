import { describe, expect, it } from "vitest";
import type { Rng } from "../dice/rng";
import type { TriggerActorState, TriggerContext } from "./triggers";
import { EMPTY_TURN_BUDGET, grantTurnBudget, spendMovement } from "./turnBudget";
import { eligibleReactions, EMPTY_TURN_USAGE, type PendingRoll, type ReactionCandidate } from "./rollWindow";
import { zActivationBlockData, zRollTrigger, type Activation } from "../schemas/rule-blocks/playable";

/**
 * Athlète accompli (Champion 3) — « aussitôt après avoir obtenu un Coup
 * critique, vous pouvez vous déplacer à concurrence de la moitié de votre
 * Vitesse ». Deux pièces : un moment « coup critique » pour une réaction, et
 * du mouvement accordé au budget du tour. Les attaques d'opportunité ne sont
 * pas jouées par le moteur : il n'y a rien à empêcher.
 */

const des: Rng = { nextInt: () => 0 };
const acteur = (): TriggerActorState => ({ numbers: {}, conditions: [], features: [] }) as unknown as TriggerActorState;
const ctx: TriggerContext = { actors: { edran: acteur(), gobelin: acteur() } };

const ATHLETE: Activation = {
  id: "remarkable-athlete-move",
  label: { fr: "Athlète accompli" },
  cost: { action: "none", resources: [] },
  targets: { kind: "self" },
  effects: [{ action: "grant_budget", who: "self", kind: "movement", amount: { op: "div", args: [{ op: "ref", name: "speed" }, { op: "num", value: 2 }] } }],
  variants: null,
  trigger: { on: "roll", roll: "attack", subject: "self", when: "critical" },
};

const attaque = (p: Partial<PendingRoll> = {}): PendingRoll => ({
  kind: "attack",
  roller: "edran",
  target: "gobelin",
  natural: 19,
  total: 24,
  critRange: 19,
  ac: 15,
  dc: null,
  acBonus: 0,
  damage: null,
  ...p,
});

const candidat: ReactionCandidate = { actorId: "edran", ruleKey: "champion-remarkable-athlete", activation: ATHLETE, resources: [], used: {}, usage: EMPTY_TURN_USAGE, ownTurnIndex: 0 };
const proposee = (roll: PendingRoll) => eligibleReactions({ roll, candidates: [candidat], ctx, teams: { edran: "pj", gobelin: "monstres" }, stamp: "1:0", rng: des }).choices.length === 1;

describe("le moment « coup critique »", () => {
  it("un 19 naturel pour un Champion (plage 19-20) est un critique ; un 18 n'en est pas un", () => {
    expect(proposee(attaque())).toBe(true);
    expect(proposee(attaque({ natural: 18, total: 23 }))).toBe(false);
  });

  it("sans Critique amélioré, il faut un 20 ; une attaque ratée d'office (Majesté) n'est pas un critique", () => {
    expect(proposee(attaque({ critRange: 20 }))).toBe(false);
    expect(proposee(attaque({ natural: 20, critRange: 20 }))).toBe(true);
    expect(proposee(attaque({ natural: 20, forcedMiss: true }))).toBe(false);
  });

  it("le schéma : « critique » ne se dit que d'une attaque", () => {
    expect(zRollTrigger.safeParse({ on: "roll", roll: "attack", subject: "self", when: "critical" }).success).toBe(true);
    expect(zRollTrigger.safeParse({ on: "roll", roll: "save", subject: "self", when: "critical" }).success).toBe(false);
    expect(zActivationBlockData.safeParse({ activations: [ATHLETE] }).success).toBe(true);
  });
});

describe("le mouvement accordé", () => {
  it("s'ajoute à la vitesse du tour : 9 m + 4,5 m accordés, 12 m parcourus sans dépassement, 14 m en dépassement", () => {
    const accorde = grantTurnBudget({ ...EMPTY_TURN_BUDGET, at: "1:0" }, { kind: "movement", amount: 4.5 });
    expect(accorde.extraMovement).toBe(4.5);
    expect(spendMovement(accorde, 12, 9)).toMatchObject({ over: false, moved: 12 });
    expect(spendMovement(accorde, 14, 9)).toMatchObject({ over: true, moved: 14 });
  });

  it("sans rien d'accordé, la vitesse seule compte, comme avant", () => {
    expect(spendMovement({ ...EMPTY_TURN_BUDGET, at: "1:0" }, 10, 9).over).toBe(true);
  });
});
