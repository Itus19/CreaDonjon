import { describe, expect, it } from "vitest";
import { characterSheet, resolveDeclaredModifiers, rollBonus, type CharacterBuild, type DeclaredModifier, type EquippedItem, type ResolvedRuleset } from "./sheet";
import { zModifier } from "../schemas/rule-blocks/primitives";
import { parseFormula } from "../formula";

/**
 * V3.1-155 (ADR 0074) — les valeurs calculées sur la fiche : un modificateur
 * porte une formule (« + mod. CHA, minimum 1 », « 10 + DEX + CON », la
 * colonne de la table de classe) ou un dé de bonus (« + 1d4 »), qui n'est
 * jamais réduit à un nombre. Nouvelles cibles : attaque, dégâts, critique,
 * vitesses, sens, maîtrises, CA sans armure.
 */

const f = (t: string) => parseFormula(t);

const ruleset = (features: Record<string, { source: string; modifiers: DeclaredModifier[] }>): ResolvedRuleset => ({
  classes: {
    barbarian: { key: "barbarian", label: "Barbare", hitDie: 12, savingThrowProficiencies: ["str", "con"], progression: { 1: { class_specific_rage_damage_bonus: 2 }, 9: { class_specific_rage_damage_bonus: 3 } } },
    paladin: { key: "paladin", label: "Paladin", hitDie: 10, savingThrowProficiencies: ["wis", "cha"] },
    monk: { key: "monk", label: "Moine", hitDie: 8, savingThrowProficiencies: ["str", "dex"] },
  },
  features: Object.fromEntries(
    Object.entries(features).map(([key, v]) => [key, { key, label: key, source: v.source, modifiers: resolveDeclaredModifiers(v.modifiers, key, key, 3) }]),
  ),
});

const build = (classe: string, level: number, abilities: Partial<Record<"str" | "dex" | "con" | "int" | "wis" | "cha", number>>, featureKeys: string[], choices?: Record<string, unknown>): CharacterBuild => ({
  species: "human",
  classes: [{ key: classe, level }],
  abilities: { assigned: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10, ...abilities } },
  featureKeys,
  ...(choices ? { choices } : {}),
});

const armure = (label: string, category: EquippedItem["armorCategory"], op: "set" | "add", value: number): EquippedItem => ({
  key: label,
  label,
  equipped: true,
  armorCategory: category,
  modifiers: [{ target: "ac", op, value, source: `item:${label}`, label, layer: 6 }],
});

describe("valeur en formule", () => {
  it("Aura de protection : max(1, mod. CHA) aux six sauvegardes", () => {
    const rs = ruleset({ aura: { source: "class:paladin", modifiers: [{ target: "save", op: "add", value: f("max(1, {ability.cha})") }] } });
    const s = characterSheet(build("paladin", 6, { cha: 16 }, ["aura"]), rs, [], []);
    expect(s.savingThrows.str.mod).toBe(3);
    expect(s.savingThrows.cha.mod).toBe(3 + 3 + 3); // CHA +3, maîtrise +3, aura +3
    expect(s.savingThrows.str.sources.map((x) => x.label)).toContain("aura");
    // Minimum 1 : CHA 8 donne quand même +1.
    expect(characterSheet(build("paladin", 6, { cha: 8 }, ["aura"]), rs, [], []).savingThrows.str.mod).toBe(1);
  });

  it("une colonne de la table de la classe qui accorde la règle (bonus de dégâts de la Rage)", () => {
    const rs = ruleset({ rage: { source: "class:barbarian", modifiers: [{ target: "damage.weapon.str", op: "add", value: f("{column.class_specific_rage_damage_bonus}") }] } });
    expect(rollBonus(characterSheet(build("barbarian", 1, {}, ["rage"]), rs, [], []), { roll: "damage", kind: "weapon", ability: "str" }).value).toBe(2);
    expect(rollBonus(characterSheet(build("barbarian", 9, {}, ["rage"]), rs, [], []), { roll: "damage", kind: "weapon", ability: "str" }).value).toBe(3);
    // Une attaque de Dextérité ne reçoit rien.
    expect(rollBonus(characterSheet(build("barbarian", 9, {}, ["rage"]), rs, [], []), { roll: "damage", kind: "weapon", ability: "dex" }).value).toBe(0);
  });

  it("une formule incalculable compte 0 et lève un avertissement, sans arrêter la fiche", () => {
    const rs = ruleset({ x: { source: "class:paladin", modifiers: [{ target: "save.wis", op: "add", value: f("{inconnue}") }] } });
    const s = characterSheet(build("paladin", 1, {}, ["x"]), rs, [], []);
    expect(s.savingThrows.wis.mod).toBe(2);
    expect(s.warnings.some((w) => w.kind === "modifier_formula")).toBe(true);
  });
});

describe("dés de bonus", () => {
  it("Bénédiction : + 1d4 aux sauvegardes et aux attaques, jamais réduit à un nombre", () => {
    const beni = [
      { target: "save", op: "add" as const, formula: f("1d4"), source: "effect:bless", label: "Bénédiction", layer: 7 as const },
      { target: "attack", op: "add" as const, formula: f("1d4"), source: "effect:bless", label: "Bénédiction", layer: 7 as const },
    ];
    const s = characterSheet(build("paladin", 1, { wis: 12 }, []), ruleset({}), [], [{ key: "bless", label: "Bénédiction", modifiers: beni }]);
    expect(s.savingThrows.wis.mod).toBe(1 + 2);
    expect(s.savingThrows.wis.dice).toEqual([{ count: 1, faces: 4, label: "Bénédiction", source: "effect:bless" }]);
    expect(s.savingThrows.str.dice).toHaveLength(1);
    const att = rollBonus(s, { roll: "attack", kind: "spell" });
    expect(att.value).toBe(0);
    expect(att.dice).toEqual([{ count: 1, faces: 4, label: "Bénédiction", source: "effect:bless" }]);
  });

  it("un dé et un nombre dans la même formule se séparent (« 1d4 + 1 »)", () => {
    const s = characterSheet(build("paladin", 1, {}, []), ruleset({}), [], [
      { key: "x", label: "X", modifiers: [{ target: "save.dex", op: "add", formula: f("1d4 + 1"), source: "fx", label: "X", layer: 7 }] },
    ]);
    expect(s.savingThrows.dex.mod).toBe(1);
    expect(s.savingThrows.dex.dice).toEqual([{ count: 1, faces: 4, label: "X", source: "fx" }]);
  });

  it("Zod refuse un dé sur une cible fixe (CA), l'accepte sur une cible de jet", () => {
    expect(zModifier.safeParse({ target: "ac", op: "add", value: f("1d4") }).success).toBe(false);
    expect(zModifier.safeParse({ target: "save.wis", op: "add", value: f("1d4") }).success).toBe(true);
    expect(zModifier.safeParse({ target: "ac", op: "set", value: f("10 + {ability.dex}") }).success).toBe(true);
  });
});

describe("CA sans armure", () => {
  const barbare = ruleset({ uad: { source: "class:barbarian", modifiers: [{ target: "ac.unarmored", op: "set", value: f("10 + {ability.dex} + {ability.con}") }] } });
  const moine = ruleset({ uad: { source: "class:monk", modifiers: [{ target: "ac.unarmored_no_shield", op: "set", value: f("10 + {ability.dex} + {ability.wis}") }] } });

  it("Barbare : 10 + DEX + CON sans armure, bouclier en plus ; une armure reprend la main", () => {
    const b = build("barbarian", 1, { dex: 14, con: 16 }, ["uad"]);
    expect(characterSheet(b, barbare, [], []).ac.value).toBe(15);
    expect(characterSheet(b, barbare, [armure("Bouclier", "Shield", "add", 2)], []).ac.value).toBe(17);
    expect(characterSheet(b, barbare, [armure("Cuir", "Light", "set", 13)], []).ac.value).toBe(13);
  });

  it("la meilleure base l'emporte : sans armure, jamais moins que 10 + DEX", () => {
    expect(characterSheet(build("barbarian", 1, { dex: 14, con: 6 }, ["uad"]), barbare, [], []).ac.value).toBe(12);
  });

  it("Moine : ignorée avec un bouclier", () => {
    const m = build("monk", 1, { dex: 16, wis: 14 }, ["uad"]);
    expect(characterSheet(m, moine, [], []).ac.value).toBe(15);
    expect(characterSheet(m, moine, [armure("Bouclier", "Shield", "add", 2)], []).ac.value).toBe(15); // 10 + 3, + 2 du bouclier
  });
});

describe("nouvelles cibles", () => {
  it("critique : 19 à l'arme, 20 au sort", () => {
    const rs = ruleset({ champ: { source: "class:barbarian", modifiers: [{ target: "crit_range.weapon", op: "set", value: 19 }] } });
    const s = characterSheet(build("barbarian", 3, {}, ["champ"]), rs, [], []);
    expect(rollBonus(s, { roll: "attack", kind: "weapon" }).critRange).toBe(19);
    expect(rollBonus(s, { roll: "attack", kind: "spell" }).critRange).toBe(20);
  });

  it("sens et vitesses spéciales ; la vitesse de vol peut valoir la vitesse au sol", () => {
    const rs = ruleset({
      x: {
        source: "species:x",
        modifiers: [
          { target: "sense.darkvision", op: "set", value: 18 },
          { target: "speed.fly", op: "set", value: f("{speed}") },
        ],
      },
    });
    const s = characterSheet(build("paladin", 1, {}, ["x"]), rs, [], []);
    expect(s.senses.darkvision?.value).toBe(18);
    expect(s.senses.blindsight).toBeUndefined();
    expect(s.speeds.fly?.value).toBe(s.speed.value);
  });

  it("maîtrises accordées par une règle, avec leur source", () => {
    const rs = ruleset({ x: { source: "class:paladin", modifiers: [{ target: "prof.weapon.martial", op: "proficiency" }, { target: "prof.armor.heavy", op: "proficiency" }] } });
    const s = characterSheet(build("paladin", 1, {}, ["x"]), rs, [], []);
    expect(s.grantedProficiencies).toEqual([
      { target: "prof.weapon.martial", label: "x" },
      { target: "prof.armor.heavy", label: "x" },
    ]);
  });

  it("type de dégâts choisi : `damage.spell.{choice:…}` suit la réponse du personnage", () => {
    const rs = ruleset({ aff: { source: "class:paladin", modifiers: [{ target: "damage.spell.{choice:sorc.affinity}", op: "add", value: f("{ability.cha}") }] } });
    const s = characterSheet(build("paladin", 6, { cha: 16 }, ["aff"], { "sorc.affinity": "fire" }), rs, [], []);
    expect(rollBonus(s, { roll: "damage", kind: "spell", damageType: "fire" }).value).toBe(3);
    expect(rollBonus(s, { roll: "damage", kind: "spell", damageType: "cold" }).value).toBe(0);
    // Sans réponse : rien, jamais tous les types.
    expect(rollBonus(characterSheet(build("paladin", 6, { cha: 16 }, ["aff"]), rs, [], []), { roll: "damage", kind: "spell", damageType: "fire" }).value).toBe(0);
  });
});
