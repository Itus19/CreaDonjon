import { describe, expect, it, vi } from "vitest";
import type { ActiveDurableEffect } from "@/src/core/rules/durableEffects";
import type { ActivationBlockData } from "@/src/core/schemas/rule-blocks/playable";
import {
  activationsVisibles,
  basculerCible,
  evaluerNombre,
  ligneResultat,
  nombresDeLaFiche,
  resumeActivation,
  ressourceManquante,
  ressourceRestante,
  tempsRestant,
} from "@/lib/ui/activationFiche";

const nombres = nombresDeLaFiche({
  niveau: 9,
  bonusMaitrise: 4,
  modificateurs: { str: 2, dex: 0, con: 1, int: 0, wis: 1, cha: 3 },
  ddDeSort: 15,
});

const bloc: ActivationBlockData = {
  activations: [
    {
      id: "abjure",
      label: { fr: "Abjuration d'ennemis" },
      cost: { action: "magic", resources: [{ key: "channel-divinity", amount: { op: "num", value: 1 } }] },
      targets: { kind: "enemy", count: { op: "max", args: [{ op: "ref", name: "ability.cha" }, { op: "num", value: 1 }] } },
      effects: [
        {
          action: "saving_throw",
          who: "target",
          ability: "WIS",
          dc: { op: "ref", name: "spell_save_dc" },
          on_fail: [{ action: "apply_effect", who: "target", effect: "frightened" }],
        },
      ],
      variants: null,
    },
    {
      id: "extra",
      label: { fr: "Frappe supplémentaire" },
      cost: { action: "free", resources: [] },
      targets: { kind: "self" },
      effects: [],
      variants: null,
    },
  ],
  durable_effects: [
    {
      id: "frightened",
      label: { fr: "Effrayé" },
      conditions: ["frightened"],
      modifiers: [],
      duration: { unit: "minute", amount: 1 },
      concentration: false,
      ends_on: [],
      token: null,
    },
    {
      id: "boost",
      label: { fr: "Élan" },
      conditions: [],
      modifiers: [],
      duration: { unit: "round", amount: 3 },
      concentration: false,
      ends_on: [],
      token: { uses: 1, grants: "extra" },
    },
  ],
};

function effet(extra: Partial<ActiveDurableEffect>): ActiveDurableEffect {
  return {
    instanceId: "i",
    effectId: "boost",
    activationId: "x",
    label: "Élan",
    bearer: "e1",
    source: "e1",
    conditions: [],
    modifiers: [],
    concentration: false,
    endsOn: [],
    remainingRounds: null,
    untilTurnEnd: null,
    untilRest: false,
    tokenGrants: null,
    tokenUsesLeft: 0,
    startedRound: null,
    ...extra,
  };
}

describe("nombresDeLaFiche et evaluerNombre", () => {
  it("pose les nombres que le serveur pose", () => {
    expect(nombres).toMatchObject({ level: 9, proficiency: 4, spell_save_dc: 15, "ability.cha": 3, "ability.str": 2 });
  });

  it("n'invente pas de DD sans lanceur de sorts", () => {
    const sans = nombresDeLaFiche({ niveau: 1, bonusMaitrise: 2, modificateurs: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }, ddDeSort: null });
    expect("spell_save_dc" in sans).toBe(false);
  });

  it("évalue en moyenne, sans dé lancé", () => {
    expect(evaluerNombre({ op: "ref", name: "ability.cha" }, nombres)).toBe(3);
    expect(evaluerNombre({ op: "dice", count: 2, faces: 6 }, nombres)).toBe(7);
  });

  it("rend null pour un nombre inconnu, et le dit en console", () => {
    const espion = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(evaluerNombre({ op: "ref", name: "inconnu" }, nombres)).toBeNull();
    expect(espion).toHaveBeenCalled();
    espion.mockRestore();
  });
});

describe("resumeActivation", () => {
  it("résume l'Abjuration : coût, cibles, DD, durée", () => {
    const r = resumeActivation(bloc, bloc.activations[0]!, nombres);
    expect(r.action).toBe("magic");
    expect(r.couts).toEqual([{ cle: "channel-divinity", montant: 1 }]);
    expect(r.cibles).toEqual({ genre: "enemy", max: 3 });
    expect(r.sauvegarde).toEqual({ caracteristique: "wis", dd: 15 });
    expect(r.duree).toEqual({ unit: "minute", amount: 1 });
  });

  it("une activation sur soi n'a pas de cibles", () => {
    expect(resumeActivation(bloc, bloc.activations[1]!, nombres).cibles).toBeNull();
  });

  it("sans formule de nombre, une seule cible", () => {
    const a = { ...bloc.activations[0]!, targets: { kind: "creature" as const } };
    expect(resumeActivation(bloc, a, nombres).cibles).toEqual({ genre: "creature", max: 1 });
  });

  it("une variante apporte son coût et ses effets", () => {
    const a = {
      ...bloc.activations[0]!,
      variants: [{ id: "v", label: { fr: "V" }, effects: [], cost: { action: "bonus" as const, resources: [] } }],
    };
    const r = resumeActivation(bloc, a, nombres, "v");
    expect(r.action).toBe("bonus");
    expect(r.couts).toEqual([]);
    expect(r.sauvegarde).toBeNull();
    expect(r.duree).toBeNull();
  });
});

describe("activationsVisibles", () => {
  it("cache l'activation qu'un jeton accorde tant qu'aucun effet n'en porte le jeton", () => {
    expect(activationsVisibles(bloc, [], "x").map((a) => a.id)).toEqual(["abjure"]);
  });

  it("la montre tant qu'un effet actif a des usages de jeton", () => {
    const ids = activationsVisibles(bloc, [effet({ tokenGrants: "extra", tokenUsesLeft: 1 })], "x").map((a) => a.id);
    expect(ids).toEqual(["abjure", "extra"]);
  });

  it("la cache quand le jeton est épuisé", () => {
    expect(activationsVisibles(bloc, [effet({ tokenGrants: "extra", tokenUsesLeft: 0 })], "x").map((a) => a.id)).toEqual(["abjure"]);
  });
});

describe("ressources", () => {
  const ressources = [{ key: "channel-divinity", label: { fr: "Conduit divin" }, max: 2, recharge: "short_rest_one" as const, source: "paladin" }];

  it("le restant est le maximum moins les usages consommés", () => {
    expect(ressourceRestante(ressources[0]!, { "channel-divinity": 1 })).toEqual({ cle: "channel-divinity", max: 2, restants: 1 });
    expect(ressourceRestante(ressources[0]!, {}).restants).toBe(2);
    expect(ressourceRestante(ressources[0]!, { "channel-divinity": 5 }).restants).toBe(0);
  });

  it("repère la ressource que le coût ne peut pas payer", () => {
    const cout = [{ cle: "channel-divinity", montant: 1 }];
    expect(ressourceManquante(cout, ressources, { "channel-divinity": 1 })).toBeNull();
    expect(ressourceManquante(cout, ressources, { "channel-divinity": 2 })).toBe("channel-divinity");
    expect(ressourceManquante([{ cle: "inconnue", montant: 1 }], ressources, {})).toBe("inconnue");
    expect(ressourceManquante([], ressources, {})).toBeNull();
  });
});

describe("basculerCible", () => {
  it("coche, décoche et respecte le plafond", () => {
    expect(basculerCible([], "a", 2)).toEqual(["a"]);
    expect(basculerCible(["a"], "b", 2)).toEqual(["a", "b"]);
    expect(basculerCible(["a", "b"], "c", 2)).toEqual(["a", "b"]);
    expect(basculerCible(["a", "b"], "a", 2)).toEqual(["b"]);
  });

  it("sans plafond connu, laisse cocher (le serveur tranche)", () => {
    expect(basculerCible(["a", "b", "c"], "d", null)).toEqual(["a", "b", "c", "d"]);
  });
});

describe("ligneResultat", () => {
  const cible = { participantId: "p", label: "Gobelin A", saved: false, applied: ["Effrayé"], save: { roll: 7, total: 6, dc: 15 } };

  it("le MJ voit le jet et le DD", () => {
    expect(ligneResultat(cible, true)).toEqual({ nom: "Gobelin A", verdict: "echec", appliques: ["Effrayé"], jet: { total: 6, dc: 15 } });
  });

  it("une joueuse ne voit jamais le jet, même si la réponse le portait", () => {
    expect(ligneResultat(cible, false).jet).toBeNull();
    expect(ligneResultat(cible, false).verdict).toBe("echec");
  });

  it("une réussite, et une cible sans sauvegarde", () => {
    expect(ligneResultat({ ...cible, saved: true, applied: [] }, false).verdict).toBe("reussite");
    expect(ligneResultat({ participantId: "p", label: "A", saved: null, applied: ["X"] }, true)).toEqual({ nom: "A", verdict: null, appliques: ["X"], jet: null });
  });
});

describe("tempsRestant", () => {
  it("dit les rounds, la fin de tour, le repos ou rien de chiffré", () => {
    expect(tempsRestant({ remainingRounds: 7, untilTurnEnd: null, untilRest: false })).toEqual({ genre: "rounds", rounds: 7 });
    expect(tempsRestant({ remainingRounds: 10, untilTurnEnd: null, untilRest: false })).toEqual({ genre: "minutes", minutes: 1 });
    expect(tempsRestant({ remainingRounds: 100, untilTurnEnd: null, untilRest: false })).toEqual({ genre: "minutes", minutes: 10 });
    expect(tempsRestant({ remainingRounds: 600, untilTurnEnd: null, untilRest: false })).toEqual({ genre: "heures", heures: 1 });
    expect(tempsRestant({ remainingRounds: 95, untilTurnEnd: null, untilRest: false })).toEqual({ genre: "rounds", rounds: 95 });
    expect(tempsRestant({ remainingRounds: null, untilTurnEnd: { actor: "a", left: 1 }, untilRest: false })).toEqual({ genre: "finDeTour" });
    expect(tempsRestant({ remainingRounds: null, untilTurnEnd: null, untilRest: true })).toEqual({ genre: "repos" });
    expect(tempsRestant({ remainingRounds: null, untilTurnEnd: null, untilRest: false })).toEqual({ genre: "permanent" });
  });
});
