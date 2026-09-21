import { describe, expect, it } from "vitest";
import type { Rng } from "../dice/rng";
import { resolveAttackRoll } from "./action";
import { eventsForAttack, eventsForCheck, eventsForSave, eventsForTurn } from "./gameEvents";
import { runTriggers, type Trigger, type TriggerContext } from "./triggers";

function fixedRng(values: number[]): Rng {
  let i = 0;
  return { nextInt: () => values[i++ % values.length] };
}

const CTX: TriggerContext = {
  actors: {
    bram: { conditions: ["concentrating"], features: [], numbers: { "save.con": 3 }, zone: "engaged" },
    bandit: { conditions: [], features: [], numbers: {}, zone: "engaged" },
  },
};

/** nextInt(20) = 14 -> d20 = 15 ; +3 = 18. */
const attaque = resolveAttackRoll(
  { abilityMod: 0, proficiencyBonus: 3, proficient: true, advantage: "normal" },
  fixedRng([14]),
);

describe("eventsForAttack", () => {
  it("un coup rate n'emet que attack_miss, jamais de degats", () => {
    const out = eventsForAttack({ attacker: "bandit", target: "bram", result: attaque, ac: 25 });
    expect(out.map((e) => e.event)).toEqual(["attack_miss"]);
  });

  it("un coup qui touche emet les DEUX faces de l'echange", () => {
    const out = eventsForAttack({ attacker: "bandit", target: "bram", result: attaque, ac: 11, damage: 4 });
    expect(out.map((e) => e.event)).toEqual(["attack_hit", "damage_dealt", "damage_taken"]);
    // Le meme coup, deux sujets : c'est ce qui permet a une regle de vol de
    // vie et a la concentration de s'accrocher au meme evenement.
    expect(out[1].subject).toBe("bandit");
    expect(out[2].subject).toBe("bram");
    expect(out[2].data).toMatchObject({ "event.damage": 4 });
  });

  it("porte le contexte du jet, lisible par un `ref` de condition", () => {
    const [hit] = eventsForAttack({ attacker: "bandit", target: "bram", result: attaque, ac: 11 });
    expect(hit.data).toMatchObject({ "event.roll": 18, "event.ac": 11, "event.critical": 0 });
  });
});

describe("eventsForSave", () => {
  it("reussite et echec sont deux evenements distincts, pas un drapeau", () => {
    expect(eventsForSave({ who: "bram", passed: true, total: 14, dc: 11 })[0].event).toBe("save_passed");
    expect(eventsForSave({ who: "bram", passed: false, total: 5, dc: 11 })[0].event).toBe("save_failed");
  });
});

/**
 * ADR 0028 — le jeu HORS COMBAT emet enfin quelque chose. C'est le 80 % du
 * jeu, et jusqu'ici aucune regle ne pouvait s'y accrocher.
 */
describe("eventsForCheck : les tests de competence, enfin audibles", () => {
  const trompe = (passed: boolean) =>
    eventsForCheck({ who: "bram", kind: "skill", key: "deception", ability: "cha", passed, total: 9, dc: 14 })[0];

  it("reussite et echec sont deux evenements distincts", () => {
    expect(trompe(true).event).toBe("check_passed");
    expect(trompe(false).event).toBe("check_failed");
  });

  it("etiquette la competence ET sa caracteristique gouvernante", () => {
    // Pour qu'une regle puisse viser « tout test de Charisme » sans enumerer
    // les quatre competences concernees.
    expect(trompe(false).tags).toEqual(["skill:deception", "ability:cha"]);
  });

  it("porte la marge, pas seulement le total", () => {
    expect(trompe(false).data).toMatchObject({ "event.total": 9, "event.dc": 14, "event.margin": -5 });
  });

  it("un test de caracteristique nue n'etiquette pas de competence", () => {
    const brut = eventsForCheck({ who: "bram", kind: "ability", key: "str", ability: "str", passed: true, total: 15, dc: 10 })[0];
    expect(brut.tags).toEqual(["ability:str"]);
  });
});

describe("event_has : une regle sait QUEL test a echoue", () => {
  const surMensonge: Trigger = {
    id: "il-a-vu-que-tu-mentais",
    when: { event: "check_failed" },
    if: { op: "event_has", key: "skill:deception" },
    then: [{ action: "narrate_hint", text: "Le regard se durcit : il a vu le mensonge." }],
  };

  it("part sur un mensonge evente", () => {
    const evt = eventsForCheck({ who: "bram", kind: "skill", key: "deception", ability: "cha", passed: false, total: 9, dc: 14 })[0];
    const out = runTriggers({ event: evt, triggers: [surMensonge], ctx: CTX, rng: fixedRng([10]) });
    expect(out.effects).toHaveLength(1);
  });

  it("ne part PAS sur un Athletisme rate — sans quoi l'evenement serait inutilisable", () => {
    const evt = eventsForCheck({ who: "bram", kind: "skill", key: "athletics", ability: "str", passed: false, total: 8, dc: 14 })[0];
    const out = runTriggers({ event: evt, triggers: [surMensonge], ctx: CTX, rng: fixedRng([10]) });
    expect(out.effects).toHaveLength(0);
  });

  it("une regle peut viser la caracteristique plutot que la competence", () => {
    const surCharisme: Trigger = {
      ...surMensonge,
      id: "tout-test-de-charisme",
      if: { op: "event_has", key: "ability:cha" },
    };
    const evt = eventsForCheck({ who: "bram", kind: "skill", key: "persuasion", ability: "cha", passed: false, total: 9, dc: 14 })[0];
    const out = runTriggers({ event: evt, triggers: [surCharisme], ctx: CTX, rng: fixedRng([10]) });
    expect(out.effects).toHaveLength(1);
  });
});

describe("eventsForTurn", () => {
  it("termine le tour precedent avant d'ouvrir le suivant", () => {
    const out = eventsForTurn({ ending: "bram", starting: "bandit", round: 1, newRound: false });
    expect(out.map((e) => e.event)).toEqual(["turn_end", "turn_start"]);
  });

  it("encadre un nouveau round", () => {
    const out = eventsForTurn({ ending: "bandit", starting: "bram", round: 2, newRound: true });
    expect(out.map((e) => e.event)).toEqual(["turn_end", "round_end", "round_start", "turn_start"]);
  });

  it("le tout premier tour n'a pas de tour a terminer", () => {
    const out = eventsForTurn({ starting: "bram", round: 1, newRound: true });
    expect(out.map((e) => e.event)).toEqual(["round_start", "turn_start"]);
  });
});

/**
 * V3-A2, troisieme critere : un declencheur qui echoue est journalise,
 * jamais silencieux, et n'interrompt pas le tour.
 */
describe("un declencheur fautif n'arrete pas le tour", () => {
  const fautif: Trigger = {
    id: "vise-un-fantome",
    when: { event: "damage_taken" },
    if: { op: "has_condition", who: "personne-de-ce-nom", key: "x" },
    then: [{ action: "narrate_hint", text: "jamais" }],
  };
  const sain: Trigger = {
    id: "sain",
    when: { event: "damage_taken" },
    then: [{ action: "narrate_hint", text: "le tour continue" }],
  };

  it("journalise l'echec et laisse partir les autres declencheurs", () => {
    const out = runTriggers({
      event: { event: "damage_taken", subject: "bram", data: { "event.damage": 4 } },
      triggers: [fautif, sain],
      ctx: CTX,
      rng: fixedRng([10]),
    });

    expect(out.failures).toHaveLength(1);
    expect(out.failures[0].triggerId).toBe("vise-un-fantome");
    expect(out.failures[0].reason).toContain("personne-de-ce-nom");
    // Jamais silencieux : l'echec figure AUSSI dans la trace lisible.
    expect(out.trace.some((l) => l.includes("ECHEC"))).toBe(true);
    // Et surtout : le tour a continue.
    expect(out.effects).toEqual([{ action: "narrate_hint", text: "le tour continue" }]);
    expect(out.error).toBeUndefined();
  });

  it("une volee sans faute ne journalise rien", () => {
    const out = runTriggers({
      event: { event: "damage_taken", subject: "bram", data: { "event.damage": 4 } },
      triggers: [sain],
      ctx: CTX,
      rng: fixedRng([10]),
    });
    expect(out.failures).toHaveLength(0);
  });
});

describe("de bout en bout : une attaque reelle reveille la concentration", () => {
  it("le coup emis par eventsForAttack declenche la sauvegarde", () => {
    const concentration: Trigger = {
      id: "concentration",
      when: { event: "damage_taken" },
      if: {
        op: "and",
        args: [
          { op: "has_condition", who: "bram", key: "concentrating" },
          { op: "gte", args: [{ op: "ref", name: "event.damage" }, { op: "num", value: 1 }] },
        ],
      },
      then: [
        {
          action: "saving_throw",
          who: "bram",
          ability: "con",
          dc: { op: "max", args: [{ op: "num", value: 10 }, { op: "num", value: 2 }] },
          on_fail: [{ action: "remove_condition", who: "bram", key: "concentrating" }],
        },
      ],
    };

    const events = eventsForAttack({ attacker: "bandit", target: "bram", result: attaque, ac: 11, damage: 4 });
    const subi = events.find((e) => e.event === "damage_taken")!;

    const out = runTriggers({ event: subi, triggers: [concentration], ctx: CTX, rng: fixedRng([1]) });
    expect(out.effects.find((e) => e.action === "saving_throw")).toMatchObject({ dc: 10, passed: false });
    expect(out.effects).toContainEqual(
      expect.objectContaining({ action: "remove_condition", key: "concentrating" }),
    );
  });
});
