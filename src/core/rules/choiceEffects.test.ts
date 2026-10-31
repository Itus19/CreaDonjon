import { describe, expect, it } from "vitest";
import { characterSheet, spellNumbers, type CharacterBuild, type ResolvedRuleset } from "./sheet";
import { bestSpellAbility, skillChoiceEffects, spellAbilityEffects } from "./choiceEffects";

const CLERIC = { key: "cleric", label: "Clerc", hitDie: 8, savingThrowProficiencies: ["wis", "cha"] as const };

function fiche(featureKeys: string[] = []) {
  const build: CharacterBuild = {
    species: "elf",
    classes: [{ key: "cleric", level: 1 }],
    abilities: { assigned: { str: 10, dex: 12, con: 14, int: 8, wis: 15, cha: 13 } },
    featureKeys,
  };
  const ruleset: ResolvedRuleset = {
    classes: { cleric: CLERIC },
    features: {
      acolyte: {
        key: "acolyte",
        label: "Acolyte",
        source: "background:acolyte",
        modifiers: [{ target: "skill.insight", op: "proficiency", layer: 4, source: "background:acolyte", label: "Acolyte" }],
      },
      "choice:keen-senses.skills": {
        key: "choice:keen-senses.skills",
        label: "Sens aiguisés",
        source: "keen-senses",
        modifiers: [{ target: "skill.perception", op: "proficiency", layer: 2, source: "keen-senses", label: "Sens aiguisés" }],
      },
    },
  };
  return characterSheet(build, ruleset, [], []);
}

describe("le DD et l'attaque des sorts, une seule formule (V3.1-50)", () => {
  it("DD = 8 + maîtrise + modificateur ; attaque = maîtrise + modificateur", () => {
    expect(spellNumbers(2, 2)).toEqual({ saveDc: 12, attackBonus: 4 });
    expect(spellNumbers(-1, 3)).toEqual({ saveDc: 10, attackBonus: 2 });
  });
});

describe("la caractéristique d'incantation d'un trait : l'effet de chaque option", () => {
  it("chaque option donne son modificateur, son DD et son attaque pour CE personnage", () => {
    expect(spellAbilityEffects(fiche(), ["int", "wis", "cha"])).toEqual([
      { ability: "int", mod: -1, saveDc: 9, attackBonus: 1 },
      { ability: "wis", mod: 2, saveDc: 12, attackBonus: 4 },
      { ability: "cha", mod: 1, saveDc: 11, attackBonus: 3 },
    ]);
  });

  it("suit les valeurs de caractéristique en direct", () => {
    const sheet = fiche();
    const plus = { ...sheet, abilities: { ...sheet.abilities, cha: { ...sheet.abilities.cha, score: 17, mod: 3 } } };
    expect(spellAbilityEffects(plus, ["cha"])).toEqual([{ ability: "cha", mod: 3, saveDc: 13, attackBonus: 5 }]);
  });

  it("signale la caractéristique de la classe si elle est proposée, sinon la meilleure", () => {
    const effets = spellAbilityEffects(fiche(), ["int", "wis", "cha"]);
    expect(bestSpellAbility(effets, "cha")).toBe("cha");
    expect(bestSpellAbility(effets, "str")).toBe("wis");
    expect(bestSpellAbility(effets, undefined)).toBe("wis");
    expect(bestSpellAbility([], undefined)).toBeNull();
  });
});

describe("un choix de compétence : ce qu'il donnerait", () => {
  it("le total si on la choisit ; une compétence déjà maîtrisée ailleurs ne donne rien de plus, et dit d'où elle vient", () => {
    const sheet = fiche(["acolyte"]);
    expect(skillChoiceEffects(sheet, ["insight", "survival"], "choice:keen-senses.skills")).toEqual([
      { skill: "insight", current: 4, ifChosen: 4, alreadyFrom: "Acolyte" },
      { skill: "survival", current: 2, ifChosen: 4, alreadyFrom: null },
    ]);
  });

  it("la maîtrise que donne CE choix ne compte pas comme « déjà maîtrisée »", () => {
    const sheet = fiche(["choice:keen-senses.skills"]);
    expect(skillChoiceEffects(sheet, ["perception"], "choice:keen-senses.skills")).toEqual([
      { skill: "perception", current: 4, ifChosen: 4, alreadyFrom: null },
    ]);
  });
});
