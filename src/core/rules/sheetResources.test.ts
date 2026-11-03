import { describe, expect, it } from "vitest";
import { characterSheet, type CharacterBuild, type EquippedItem, type ResolvedRuleset } from "./sheet";

/**
 * V3.1-129 (ADR 0060 §1) — les ressources déclarées par les règles. La fiche
 * les CALCULE depuis les aptitudes du personnage : aucun compteur n'est écrit
 * sur le personnage (règle absolue 16). L'état de jeu ne garde que les usages.
 */

const PALADIN = {
  key: "paladin",
  label: "Paladin",
  hitDie: 10,
  savingThrowProficiencies: ["wis", "cha"] as const,
  // Colonnes de la progression : niveau de classe -> clé -> valeur (SRD 5.2.1 : 2 au niveau 3, 3 au niveau 11).
  progression: { 3: { class_specific_channel_divinity_charges: 2 }, 9: { class_specific_channel_divinity_charges: 2 }, 11: { class_specific_channel_divinity_charges: 3 } },
};
const GUERRIER = { key: "fighter", label: "Guerrier", hitDie: 10, savingThrowProficiencies: ["str", "con"] as const };

const ruleset: ResolvedRuleset = {
  classes: { paladin: PALADIN, fighter: GUERRIER },
  features: {
    "channel-divinity-paladin": {
      key: "channel-divinity-paladin",
      label: "Conduit divin",
      source: "class:paladin",
      modifiers: [],
      resources: [{ key: "channel-divinity", label: { fr: "Conduit divin" }, max: { op: "ref", name: "column.class_specific_channel_divinity_charges" }, recharge: "short_rest_one" }],
    },
    "lay-on-hands": {
      key: "lay-on-hands",
      label: "Imposition des mains",
      source: "class:paladin",
      modifiers: [],
      resources: [{ key: "lay-on-hands", label: { fr: "Imposition des mains" }, max: { op: "mul", args: [{ op: "ref", name: "class.level" }, { op: "num", value: 5 }] }, recharge: "long_rest" }],
    },
    "lucky": {
      key: "lucky",
      label: "Chanceux",
      source: "feat:lucky",
      modifiers: [],
      resources: [{ key: "luck", label: { fr: "Points de chance" }, max: { op: "ref", name: "proficiency" }, recharge: "long_rest" }],
    },
  },
};

const build = (level: number, featureKeys: string[], classes = [{ key: "paladin", level }]): CharacterBuild => ({
  species: "human",
  classes,
  abilities: { assigned: { str: 16, dex: 10, con: 14, int: 8, wis: 12, cha: 16 } },
  featureKeys,
});

describe("characterSheet — ressources déclarées", () => {
  it("un paladin 9 a 2 Conduits divins, lus dans sa progression", () => {
    const sheet = characterSheet(build(9, ["channel-divinity-paladin"]), ruleset, [], []);
    expect(sheet.resources).toEqual([
      { key: "channel-divinity", label: { fr: "Conduit divin" }, max: 2, recharge: "short_rest_one", source: "channel-divinity-paladin" },
    ]);
  });

  it("la colonne suit le niveau DE LA CLASSE, pas du personnage : paladin 11 → 3 ; paladin 9 / guerrier 2 → 2", () => {
    expect(characterSheet(build(11, ["channel-divinity-paladin"]), ruleset, [], []).resources[0].max).toBe(3);
    const multi = build(9, ["channel-divinity-paladin"], [{ key: "paladin", level: 9 }, { key: "fighter", level: 2 }]);
    expect(characterSheet(multi, ruleset, [], []).resources[0].max).toBe(2);
  });

  it("entre deux lignes de la progression, la dernière ligne atteinte vaut (niveau 10 → celle du 9)", () => {
    expect(characterSheet(build(10, ["channel-divinity-paladin"]), ruleset, [], []).resources[0].max).toBe(2);
  });

  it("`class.level`, `proficiency` : Imposition des mains 5 × niveau de paladin ; Chanceux = bonus de maîtrise", () => {
    const sheet = characterSheet(build(5, ["lay-on-hands", "lucky"]), ruleset, [], []);
    expect(sheet.resources.map((r) => [r.key, r.max])).toEqual([
      ["lay-on-hands", 25],
      ["luck", 3],
    ]);
  });

  it("un objet ne compte ses ressources qu'équipé, et lié s'il demande un lien", () => {
    const baton = (equipped: boolean, attuned?: boolean): EquippedItem => ({
      key: "staff",
      label: "Bâton",
      equipped,
      modifiers: [],
      requiresAttunement: true,
      ...(attuned !== undefined ? { attuned } : {}),
      resources: [{ key: "staff-charges", label: { fr: "Charges" }, max: { op: "num", value: 10 }, recharge: "dawn" }],
    });
    expect(characterSheet(build(3, []), ruleset, [baton(true, true)], []).resources.map((r) => r.key)).toEqual(["staff-charges"]);
    expect(characterSheet(build(3, []), ruleset, [baton(true, false)], []).resources).toEqual([]);
    expect(characterSheet(build(3, []), ruleset, [baton(false, true)], []).resources).toEqual([]);
  });

  it("deux fiches qui déclarent la même ressource : une seule ligne, le plus grand maximum", () => {
    const double: ResolvedRuleset = {
      ...ruleset,
      features: {
        ...ruleset.features,
        "cd-bis": { ...ruleset.features["channel-divinity-paladin"]!, key: "cd-bis", resources: [{ key: "channel-divinity", label: { fr: "Conduit divin" }, max: { op: "num", value: 5 }, recharge: "short_rest_one" }] },
      },
    };
    const sheet = characterSheet(build(9, ["channel-divinity-paladin", "cd-bis"]), double, [], []);
    expect(sheet.resources).toHaveLength(1);
    expect(sheet.resources[0]).toMatchObject({ max: 5, source: "cd-bis" });
  });

  it("une formule qui lit une référence inconnue ne casse pas la fiche : la ressource tombe à 0 avec un avertissement", () => {
    const casse: ResolvedRuleset = {
      ...ruleset,
      features: { x: { key: "x", label: "X", source: "class:fighter", modifiers: [], resources: [{ key: "x", label: { fr: "X" }, max: { op: "ref", name: "column.absente" }, recharge: "long_rest" }] } },
    };
    const sheet = characterSheet(build(1, ["x"], [{ key: "fighter", level: 1 }]), casse, [], []);
    expect(sheet.resources[0].max).toBe(0);
    expect(sheet.warnings).toContainEqual(expect.objectContaining({ kind: "resource_formula", featureKey: "x" }));
  });

  it("sans fiche qui en déclare, aucune ressource", () => {
    expect(characterSheet(build(3, []), ruleset, [], []).resources).toEqual([]);
  });
});
