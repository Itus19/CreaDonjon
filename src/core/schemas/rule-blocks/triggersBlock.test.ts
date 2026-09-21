import { describe, expect, it } from "vitest";
import { BLOCK_TYPES, validateBlockData, type BlockType } from "./blocks";

/**
 * Le magasin de declencheurs (V3-A2) : aucune table nouvelle, un BLOC TYPE.
 * Ces tests verrouillent le fait qu'un declencheur soit une donnee de regle
 * comme une autre — donc soumise au meme registre, au meme Zod, au meme
 * heritage de ruleset que `modifiers`.
 */

const concentration = {
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
      dc: { op: "max", args: [{ op: "num", value: 10 }, { op: "num", value: 5 }] },
      on_fail: [{ action: "remove_condition", who: "self", key: "concentrating" }],
    },
  ],
};

describe("le bloc `triggers` est un bloc de regle comme un autre", () => {
  it("figure au catalogue ferme des types de bloc", () => {
    expect(BLOCK_TYPES).toContain("triggers" satisfies BlockType);
  });

  it("accepte une regle reelle, la concentration", () => {
    expect(() => validateBlockData("triggers", { triggers: [concentration] })).not.toThrow();
  });

  it("accepte une fiche sans aucun declencheur", () => {
    expect(() => validateBlockData("triggers", { triggers: [] })).not.toThrow();
  });

  it("refuse un evenement hors vocabulaire — la fermeture tient jusqu'en base", () => {
    expect(() =>
      validateBlockData("triggers", {
        triggers: [{ ...concentration, when: { event: "le_joueur_eternue" } }],
      }),
    ).toThrow();
  });

  it("refuse un declencheur sans effet : une regle qui ne fait rien est une erreur de saisie", () => {
    expect(() => validateBlockData("triggers", { triggers: [{ ...concentration, then: [] }] })).toThrow();
  });
});
