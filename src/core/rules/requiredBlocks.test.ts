import { describe, expect, it } from "vitest";
import { missingRequiredBlocks } from "./requiredBlocks";

describe("missingRequiredBlocks", () => {
  it("ne signale rien quand tous les blocs requis sont presents", () => {
    expect(missingRequiredBlocks("spell", ["spell_casting", "effects", "description"], { descriptionText: "Make a ranged spell attack." })).toEqual([]);
  });

  it("signale les blocs requis absents, sans rejeter l'entree", () => {
    expect(missingRequiredBlocks("spell", ["description"], { descriptionText: "Each creature must succeed on a Dexterity saving throw." })).toEqual(["spell_casting", "effects"]);
  });

  // V3.1-1 : la plupart des sorts (buffs, utilitaires, mise en scene) n'ont
  // legitimement aucun effet chiffre ; `effects` n'est attendu que si la
  // description parle d'un jet de sauvegarde, d'un jet d'attaque de sort, ou
  // de des de degats ou de soins.
  describe("bloc effects d'un sort (V3.1-1)", () => {
    it("n'exige pas effects pour un sort utilitaire (Detection de la magie)", () => {
      const text = "For the duration, you sense the presence of magical effects within 30 feet of yourself.";
      expect(missingRequiredBlocks("spell", ["spell_casting", "description"], { descriptionText: text })).toEqual([]);
    });

    it("n'exige pas effects sans description du tout", () => {
      expect(missingRequiredBlocks("spell", ["spell_casting"])).toEqual([]);
    });

    it("n'exige pas effects pour un bonus de de qui n'est ni degats ni soins (Assistance)", () => {
      const text = "Once before the spell ends, the target can roll a d4 and add the number rolled to one ability check.";
      expect(missingRequiredBlocks("spell", ["spell_casting"], { descriptionText: text })).toEqual([]);
    });

    it.each([
      ["jet de sauvegarde (anglais)", "The target must make a Wisdom saving throw."],
      ["jet de sauvegarde (francais)", "La cible doit reussir un jet de sauvegarde de Sagesse."],
      ["jet d'attaque de sort (anglais)", "Make a ranged spell attack against the target."],
      ["jet d'attaque de sort (francais)", "Faites un jet d'attaque de sort a distance contre la cible."],
      ["des de degats (anglais)", "The target takes 3d6 Fire damage."],
      ["des de degats (francais)", "La cible subit 3d6 degats de feu."],
      ["des de degats accentues (francais)", "La cible subit 1d10 dégâts de froid."],
      ["des de soins (anglais)", "The target regains Hit Points equal to 2d8 plus your spellcasting ability modifier."],
      ["des de soins (francais)", "La cible recupere un nombre de points de vie egal a 2d8."],
    ])("exige effects quand la description mentionne un %s", (_label, text) => {
      expect(missingRequiredBlocks("spell", ["spell_casting"], { descriptionText: text })).toEqual(["effects"]);
    });

    it("ne signale rien quand le sort a deja son bloc effects", () => {
      expect(missingRequiredBlocks("spell", ["spell_casting", "effects"], { descriptionText: "Make a ranged spell attack." })).toEqual([]);
    });

    it("garde le bloc effects facultatif hors des sorts (aucun autre type ne change)", () => {
      expect(missingRequiredBlocks("monster", [], { descriptionText: "Make a Wisdom saving throw." })).toEqual(["stat_block", "actions"]);
    });
  });

  it("signale les trois blocs requis manquants pour une classe (V1-D1)", () => {
    expect(missingRequiredBlocks("class", ["description"])).toEqual(["class_progression", "class_basics", "subclass_slot"]);
  });

  it("signale un seul bloc manquant pour une classe qui a deja sa progression et sa base", () => {
    expect(missingRequiredBlocks("class", ["description", "class_progression", "class_basics"])).toEqual(["subclass_slot"]);
  });

  it("ne signale rien pour un entry_type sans bloc requis declare", () => {
    expect(missingRequiredBlocks("feature", [])).toEqual([]);
  });

  it("signale le bloc d'effets manquant pour une condition (V1-D7)", () => {
    expect(missingRequiredBlocks("condition", [])).toEqual(["condition_effects"]);
  });

  it("signale le bloc d'aptitudes manquant pour une sous-classe (V1-D7)", () => {
    expect(missingRequiredBlocks("subclass", [])).toEqual(["subclass_features"]);
  });
});
