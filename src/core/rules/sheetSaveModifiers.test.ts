import { describe, expect, it } from "vitest";
import { characterSheet, type ActiveEffect, type CharacterBuild, type EquippedItem, type Modifier, type ResolvedRuleset } from "./sheet";

/**
 * Les bonus chiffrés sur un jet de sauvegarde ou une compétence. Le catalogue
 * des cibles (`modifierTargets.ts`) propose « ajouter » sur `save.<car>` et
 * `skill.<clé>` : `characterSheet()` doit donc les appliquer, comme il le fait
 * pour la CA ou les PV — même pile, mêmes règles d'empilement, sources
 * visibles. Sans modificateur, rien ne change.
 */

const GUERRIER = { key: "fighter", label: "Guerrier", hitDie: 10, savingThrowProficiencies: ["str", "con"] as const };
const ruleset: ResolvedRuleset = { classes: { fighter: GUERRIER }, features: {} };
// Sagesse 12 (+1), Dextérité 14 (+2) ; niveau 1, maîtrise +2 ; maîtrise de Force et Constitution.
const build: CharacterBuild = {
  species: "human",
  classes: [{ key: "fighter", level: 1 }],
  abilities: { assigned: { str: 16, dex: 14, con: 14, int: 8, wis: 12, cha: 10 } },
  featureKeys: [],
};

const mod = (target: string, value: number, label: string, extra: Partial<Modifier> = {}): Modifier => ({
  target,
  op: "add",
  value,
  source: `test:${label}`,
  label,
  layer: 6,
  ...extra,
});
const objet = (modifiers: Modifier[], equipped = true): EquippedItem => ({ key: "cape", label: "Cape", equipped, modifiers });
const effet = (modifiers: Modifier[]): ActiveEffect => ({ key: "fx", label: "Bénédiction", modifiers });

describe("characterSheet — bonus chiffrés sur les sauvegardes", () => {
  it("sans modificateur : caractéristique + maîtrise, comme avant", () => {
    const s = characterSheet(build, ruleset, [], []);
    expect(s.savingThrows.wis.mod).toBe(1);
    expect(s.savingThrows.con.mod).toBe(4);
    expect(s.savingThrows.con.sources).toEqual([
      { label: "Constitution", value: 2 },
      { label: "Maitrise", value: 2 },
    ]);
  });

  it("un objet équipé « +1 aux sauvegardes de Sagesse » s'ajoute, et sa source se voit", () => {
    const s = characterSheet(build, ruleset, [objet([mod("save.wis", 1, "Cape de protection")])], []);
    expect(s.savingThrows.wis.mod).toBe(2);
    expect(s.savingThrows.wis.sources).toEqual([
      { label: "Sagesse", value: 1 },
      { label: "Cape de protection", value: 1 },
    ]);
  });

  it("un objet non équipé ne compte pas", () => {
    expect(characterSheet(build, ruleset, [objet([mod("save.wis", 1, "Cape")], false)], []).savingThrows.wis.mod).toBe(1);
  });

  it("un effet actif (couche 7) s'ajoute à une sauvegarde maîtrisée", () => {
    const s = characterSheet(build, ruleset, [], [effet([mod("save.con", 2, "Bénédiction", { layer: 7 })])]);
    expect(s.savingThrows.con.mod).toBe(6);
    expect(s.savingThrows.con.sources.map((x) => x.label)).toEqual(["Constitution", "Maitrise", "Bénédiction"]);
  });

  it("l'empilement suit les règles de la pile : « highest » ne garde que le plus fort", () => {
    const s = characterSheet(
      build,
      ruleset,
      [objet([mod("save.wis", 1, "Anneau", { stacking: "highest" }), mod("save.wis", 2, "Cape", { stacking: "highest" })])],
      [],
    );
    expect(s.savingThrows.wis.mod).toBe(3);
    expect(s.savingThrows.wis.sources.map((x) => x.label)).toEqual(["Sagesse", "Cape"]);
  });

  it("un bonus sur une autre sauvegarde ne déborde pas", () => {
    const s = characterSheet(build, ruleset, [objet([mod("save.wis", 1, "Cape")])], []);
    expect(s.savingThrows.dex.mod).toBe(2);
  });
});

describe("characterSheet — bonus chiffrés sur les compétences", () => {
  it("sans modificateur : inchangé", () => {
    expect(characterSheet(build, ruleset, [], []).skills.stealth.mod).toBe(2);
  });

  it("« +2 en Discrétion » s'ajoute après la caractéristique et la maîtrise, avec sa source", () => {
    const prof: Modifier = { target: "skill.stealth", op: "proficiency", source: "class:fighter", label: "Guerrier", layer: 3 };
    // Sans maîtrise : Dextérité + bonus.
    const s = characterSheet(build, ruleset, [objet([mod("skill.stealth", 2, "Bottes elfiques")])], []);
    const build2 = { ...build, featureKeys: ["f"] };
    const avecMaitrise = characterSheet(build2, { ...ruleset, features: { f: { key: "f", label: "F", source: "class:fighter", modifiers: [prof] } } }, [objet([mod("skill.stealth", 2, "Bottes elfiques")])], []);
    expect(s.skills.stealth.mod).toBe(4);
    expect(avecMaitrise.skills.stealth.mod).toBe(6);
    expect(avecMaitrise.skills.stealth.sources).toEqual([
      { label: "Dextérité", value: 2 },
      { label: "Maitrise", value: 2 },
      { label: "Bottes elfiques", value: 2 },
    ]);
  });
});
