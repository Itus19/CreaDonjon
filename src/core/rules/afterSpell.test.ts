import { describe, expect, it } from "vitest";
import { proposalsAfterSpell, spellCastMatches } from "./afterSpell";
import { zActivationBlockData, type ActivationBlockData } from "../schemas/rule-blocks/playable";

/**
 * V3.1-184 — une utilisation proposée après un sort lancé : « Aussitôt après
 * avoir lancé un sort d'Enchantement ou d'Illusion par un emplacement de
 * sort… » (Magie envoûtante).
 */
const declencheur = { on: "spell_cast" as const, schools: ["Enchantment" as const, "Illusion" as const], with_slot: true };

describe("le déclencheur « après un sort lancé »", () => {
  it("un sort d'Enchantement lancé par un emplacement le déclenche", () => {
    expect(spellCastMatches(declencheur, { school: "Enchantment", slotLevel: 1 })).toBe(true);
    expect(spellCastMatches(declencheur, { school: "Illusion", slotLevel: 2 })).toBe(true);
  });

  it("pas un sort mineur (aucun emplacement)", () => {
    expect(spellCastMatches(declencheur, { school: "Enchantment", slotLevel: 0 })).toBe(false);
  });

  it("pas un sort d'une autre école", () => {
    expect(spellCastMatches(declencheur, { school: "Evocation", slotLevel: 3 })).toBe(false);
  });

  it("l'école se compare sans tenir compte de la casse ; une école inconnue ne déclenche rien", () => {
    expect(spellCastMatches(declencheur, { school: "enchantment", slotLevel: 1 })).toBe(true);
    expect(spellCastMatches(declencheur, { school: null, slotLevel: 1 })).toBe(false);
  });

  it("l'école traduite (fiche lue en français) se reconnaît : Enchantement, Invocation, Évocation", () => {
    expect(spellCastMatches(declencheur, { school: "Enchantement", slotLevel: 1 })).toBe(true);
    expect(spellCastMatches({ on: "spell_cast", schools: ["Conjuration"] }, { school: "Invocation", slotLevel: 1 })).toBe(true);
    expect(spellCastMatches({ on: "spell_cast", schools: ["Evocation"] }, { school: "Évocation", slotLevel: 1 })).toBe(true);
    expect(spellCastMatches({ on: "spell_cast", schools: ["Necromancy"] }, { school: "Nécromancie", slotLevel: 1 })).toBe(true);
  });

  it("sans école ni emplacement exigés : tout sort lancé, même mineur", () => {
    expect(spellCastMatches({ on: "spell_cast" }, { school: null, slotLevel: 0 })).toBe(true);
  });

  it("le schéma l'accepte, à côté du déclencheur « en réaction à un jet »", () => {
    const bloc = {
      activations: [
        { id: "envouter", label: { fr: "Envoûter" }, cost: { action: "free", resources: [] }, targets: { kind: "creature" }, effects: [], variants: null, trigger: declencheur },
      ],
    };
    expect(zActivationBlockData.safeParse(bloc).success).toBe(true);
    const ecoleInconnue = { activations: [{ ...bloc.activations[0], trigger: { on: "spell_cast", schools: ["Chronomancie"] } }] };
    expect(zActivationBlockData.safeParse(ecoleInconnue).success).toBe(false);
  });
});

describe("ce que la fiche propose après un sort", () => {
  const magie: ActivationBlockData = zActivationBlockData.parse({
    activations: [{ id: "envouter", label: { fr: "Envoûter" }, cost: { action: "free", resources: [] }, targets: { kind: "creature" }, effects: [], variants: null, trigger: declencheur }],
  });
  const mots: ActivationBlockData = zActivationBlockData.parse({
    activations: [
      {
        id: "mots",
        label: { fr: "Mots cinglants" },
        cost: { action: "reaction", resources: [] },
        targets: { kind: "enemy" },
        effects: [],
        variants: null,
        trigger: { on: "roll", roll: "attack", subject: "enemy", when: "rolled" },
        roll_operations: [{ op: "add_die", count: { op: "num", value: 1 }, faces: { op: "num", value: 6 }, sign: -1 }],
      },
    ],
  });
  const features: { key: string; label: string; activation?: ActivationBlockData }[] = [
    { key: "college-magie-envoutante", label: "Magie envoûtante", activation: magie },
    { key: "lore-cutting-words", label: "Mots cinglants", activation: mots },
    { key: "sans-activation", label: "Rien" },
  ];

  it("après charme-personne par un emplacement : Magie envoûtante, et elle seule", () => {
    expect(proposalsAfterSpell(features, { school: "Enchantment", slotLevel: 1 })).toEqual([
      { ruleKey: "college-magie-envoutante", activationId: "envouter", label: "Envoûter", featureLabel: "Magie envoûtante" },
    ]);
  });

  it("après un sort mineur : rien", () => {
    expect(proposalsAfterSpell(features, { school: "Enchantment", slotLevel: 0 })).toEqual([]);
  });
});
