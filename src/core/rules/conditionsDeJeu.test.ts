import { describe, expect, it } from "vitest";
import { distance, inArea, zoneFromDistance, type Point } from "./geometry";
import { adjustDamage, applyEffects, type TurnState } from "./turn";
import { aurasCovering } from "./auras";
import { applyPatches } from "./patches";
import { characterSheet, resolveDeclaredModifiers, rollBonus, type CharacterBuild, type DeclaredModifier, type EquippedItem, type ResolvedFeature, type ResolvedRuleset } from "./sheet";
import { eventsForAttack } from "./gameEvents";
import { zActivationBlockData } from "../schemas/rule-blocks/playable";
import { zModifier } from "../schemas/rule-blocks/primitives";
import { parseFormula } from "../formula";

/**
 * V3.1-168 (ADR 0077) — les conditions de jeu, en fonctions PURES : la
 * géométrie du plan (distances, zones), les auras, les défenses aux dégâts,
 * les conditions d'équipement, les retouches d'une règle par une autre, et
 * les étiquettes d'arme d'une attaque.
 */

const f = (t: string) => parseFormula(t);
const p = (x: number, y: number): Point => ({ x, y });

describe("la géométrie du plan", () => {
  it("distance euclidienne ; au contact à 1,5 m ; lecture en zones", () => {
    expect(distance(p(0, 0), p(3, 4))).toBe(5);
    expect(zoneFromDistance(1.5)).toBe("engaged");
    expect(zoneFromDistance(9)).toBe("near");
    expect(zoneFromDistance(9.5)).toBe("far");
  });

  it("un cône de 4,5 m vers l'est prend les deux gobelins devant, pas celui derrière ni celui trop à côté", () => {
    const cone = { shape: "cone" as const, size: 4.5 };
    const vers = p(10, 0);
    expect(inArea(cone, p(0, 0), vers, p(3, 0))).toBe(true);
    expect(inArea(cone, p(0, 0), vers, p(4, 1.5))).toBe(true);
    expect(inArea(cone, p(0, 0), vers, p(-2, 0))).toBe(false);
    expect(inArea(cone, p(0, 0), vers, p(2, 3))).toBe(false);
    expect(inArea(cone, p(0, 0), vers, p(6, 0))).toBe(false);
  });

  it("une ligne de 9 m sur 1,5 m ; une sphère de 6 m ; un cube de 3 m centré sur le point", () => {
    const ligne = { shape: "line" as const, size: 9, width: 1.5 };
    expect(inArea(ligne, p(0, 0), p(0, 10), p(0.5, 8))).toBe(true);
    expect(inArea(ligne, p(0, 0), p(0, 10), p(1, 8))).toBe(false);
    expect(inArea({ shape: "sphere", size: 6 }, p(5, 5), p(5, 5), p(9, 9))).toBe(true);
    expect(inArea({ shape: "sphere", size: 6 }, p(5, 5), p(5, 5), p(10, 10))).toBe(false);
    expect(inArea({ shape: "cube", size: 3 }, p(0, 0), p(0, 0), p(1.5, -1.5))).toBe(true);
    expect(inArea({ shape: "cube", size: 3 }, p(0, 0), p(0, 0), p(2, 0))).toBe(false);
  });
});

describe("les défenses aux dégâts", () => {
  const defenses = { resist: ["slashing", "fire"], vulnerable: ["fire", "radiant"], immune: ["poison"] };
  it("résistance ½ (arrondi à l'inférieur), vulnérabilité ×2, immunité 0 ; résistance et vulnérabilité s'annulent ; sans type, rien", () => {
    expect(adjustDamage(13, "slashing", defenses)).toEqual({ amount: 6, reason: "resist" });
    expect(adjustDamage(5, "radiant", defenses)).toEqual({ amount: 10, reason: "vulnerable" });
    expect(adjustDamage(20, "poison", defenses)).toEqual({ amount: 0, reason: "immune" });
    expect(adjustDamage(12, "fire", defenses)).toEqual({ amount: 12, reason: null });
    expect(adjustDamage(12, undefined, defenses)).toEqual({ amount: 12, reason: null });
    expect(adjustDamage(12, "cold", defenses)).toEqual({ amount: 12, reason: null });
  });

  it("le tour applique la résistance d'un acteur et le dit", () => {
    const etat: TurnState = {
      actors: { lia: { hp: { current: 30, max: 30, temp: 0 }, conditions: [], resources: {}, budget: { action: 1, bonus: 1, reaction: 1, movement: 9, free: 1 }, defenses: { resist: ["slashing"], vulnerable: [], immune: [] } } },
    } as unknown as TurnState;
    const r = applyEffects(etat, [{ action: "deal_damage", who: "lia", amount: 12, damage_type: "slashing" }]);
    expect(r.state.actors.lia.hp.current).toBe(24);
    expect(r.changes.find((c) => c.kind === "hp")).toMatchObject({ note: expect.stringMatching(/résiste/) });
  });
});

describe("les auras", () => {
  const aura = { radius: 3, affects: "allies" as const, self: true, unless_conditions: ["incapacitated"], modifiers: [{ target: "save", op: "add" as const, value: f("max(1, {ability.cha})") }] };
  const paladin = { id: "aldric", pos: p(0, 0), team: "pj", conditions: [] as string[], numbers: { "ability.cha": 3 }, label: "Aura de protection", auras: [aura] };

  it("couvre l'allié à 3 m, pas celui à 4,5 m, ni un ennemi ; le paladin lui-même ; rien s'il est Neutralisé", () => {
    const pour = (id: string, pos: Point, team: string, sources = [paladin]) => aurasCovering({ target: { id, pos, team }, sources });
    expect(pour("lia", p(3, 0), "pj")).toEqual([{ key: "aura:aldric:0", label: "Aura de protection", modifiers: [{ target: "save", op: "add", value: 3 }] }]);
    expect(pour("lia", p(4.5, 0), "pj")).toEqual([]);
    expect(pour("gob", p(1, 0), "adversaires")).toEqual([]);
    expect(pour("aldric", p(0, 0), "pj")).toHaveLength(1);
    expect(pour("lia", p(3, 0), "pj", [{ ...paladin, conditions: ["incapacitated"] }])).toEqual([]);
  });

  it("sans position (pas encore posé), aucune aura ne s'étend", () => {
    expect(aurasCovering({ target: { id: "lia", pos: null, team: "pj" }, sources: [paladin] })).toEqual([]);
  });
});

describe("les retouches d'une règle par une autre", () => {
  it("Aura étendue porte le rayon de l'Aura de protection à 9 m ; Source d'inspiration change une recharge", () => {
    const features: ResolvedFeature[] = [
      { key: "aura", label: "Aura", source: "class:paladin", modifiers: [], auras: [{ radius: 3, affects: "allies", self: true, modifiers: [] }] },
      { key: "insp", label: "Inspiration", source: "class:bard", modifiers: [], resources: [{ key: "bardic", label: { fr: "Insp." }, max: f("3"), recharge: "long_rest" }] },
      { key: "etendue", label: "Aura étendue", source: "class:paladin", modifiers: [], patches: [{ rule: "aura", field: "aura.radius", value: 9 }] },
      { key: "source", label: "Source", source: "class:bard", modifiers: [], patches: [{ rule: "insp", field: "resource.bardic.recharge", value: "short_rest" }] },
    ];
    const r = applyPatches(features);
    expect(r.find((x) => x.key === "aura")?.auras?.[0]?.radius).toBe(9);
    expect(r.find((x) => x.key === "insp")?.resources?.[0]?.recharge).toBe("short_rest");
  });
});

describe("les conditions d'équipement", () => {
  const rs = (mods: DeclaredModifier[]): ResolvedRuleset => ({
    classes: { barbarian: { key: "barbarian", label: "Barbare", hitDie: 12, savingThrowProficiencies: ["str", "con"] } },
    features: { r: { key: "r", label: "Règle", source: "class:barbarian", modifiers: resolveDeclaredModifiers(mods, "r", "Règle", 3) } },
  });
  const build: CharacterBuild = { species: "human", classes: [{ key: "barbarian", level: 5 }], abilities: { assigned: { str: 10, dex: 14, con: 16, int: 10, wis: 10, cha: 10 } }, featureKeys: ["r"] };
  const armure = (category: EquippedItem["armorCategory"]): EquippedItem => ({ key: "a", label: "Armure", equipped: true, armorCategory: category, modifiers: category === "Shield" ? [] : [{ target: "ac", op: "set", value: 16, source: "item:a", label: "Armure", layer: 6 }] });

  it("un modificateur « sans armure lourde » ne s'applique plus en armure lourde", () => {
    const r = rs([{ target: "save.str", op: "advantage", when: { armor: ["none", "light", "medium"] } }]);
    expect(characterSheet(build, r, [], []).savingThrows.str.rollState).toBe("advantage");
    expect(characterSheet(build, r, [armure("Heavy")], []).savingThrows.str.rollState).toBe("normal");
    expect(characterSheet(build, r, [armure("Medium")], []).savingThrows.str.rollState).toBe("advantage");
  });

  it("« sans bouclier » ; « avec une arme de finesse » se lit au jet, selon l'arme", () => {
    const r = rs([{ target: "ac", op: "add", value: 1, when: { shield: false } }, { target: "damage.weapon", op: "add", value: 2, when: { wielding: "finesse" } }]);
    expect(characterSheet(build, r, [], []).ac.value).toBe(characterSheet(build, rs([]), [], []).ac.value + 1);
    expect(characterSheet(build, r, [armure("Shield")], []).ac.value).toBe(characterSheet(build, rs([]), [armure("Shield")], []).ac.value);
    const s = characterSheet(build, r, [], []);
    expect(rollBonus(s, { roll: "damage", kind: "weapon", properties: ["finesse", "light"] }).value).toBe(2);
    expect(rollBonus(s, { roll: "damage", kind: "weapon", properties: ["heavy"] }).value).toBe(0);
  });

  it("le schéma refuse une condition inconnue", () => {
    expect(zModifier.safeParse({ target: "ac", op: "add", value: 1, when: { armor: ["plate"] } }).success).toBe(false);
  });
});

describe("défenses portées par la fiche", () => {
  it("la Rage (effet qui dure) donne les résistances contondant, perforant, tranchant", () => {
    const rs: ResolvedRuleset = { classes: { barbarian: { key: "barbarian", label: "Barbare", hitDie: 12, savingThrowProficiencies: ["str", "con"] } }, features: {} };
    const build: CharacterBuild = { species: "human", classes: [{ key: "barbarian", level: 1 }], abilities: { assigned: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } }, featureKeys: [] };
    const rage = { key: "rage", label: "Rage", modifiers: ["bludgeoning", "piercing", "slashing"].map((t) => ({ target: `resist.${t}`, op: "set" as const, value: 1, source: "effect:rage", label: "Rage", layer: 7 as const })) };
    expect(characterSheet(build, rs, [], [rage]).damageDefenses).toEqual({ resist: ["bludgeoning", "piercing", "slashing"], vulnerable: [], immune: [] });
    expect(characterSheet(build, rs, [], []).damageDefenses).toEqual({ resist: [], vulnerable: [], immune: [] });
  });
});

describe("le schéma : zone, aura", () => {
  it("accepte une cible de zone et une aura sur un effet qui dure", () => {
    const r = zActivationBlockData.safeParse({
      activations: [{ id: "souffle", label: { fr: "Souffle" }, cost: { action: "attack", resources: [] }, targets: { kind: "area", area: { shape: "cone", size: 4.5, origin: "self" } }, effects: [], variants: null }],
      durable_effects: [{ id: "a", label: { fr: "Aura" }, conditions: [], modifiers: [], duration: { unit: "permanent" }, concentration: false, ends_on: [], token: null, aura: { radius: 3, affects: "allies", self: true, modifiers: [{ target: "save", op: "add", value: 2 }] } }],
    });
    expect(r.success).toBe(true);
  });
});

describe("les étiquettes d'arme d'une attaque", () => {
  it("attack_hit porte weapon:<clé> et property:<propriété>", () => {
    const ev = eventsForAttack({ attacker: "lia", target: "gob", result: { total: 18, isCritical: false, isCriticalFail: false, trace: [], ast: f("1d20"), expression: "1d20" }, ac: 12, weapon: { key: "rapier", properties: ["finesse"] } });
    expect(ev[0]).toMatchObject({ event: "attack_hit", tags: ["weapon:rapier", "property:finesse"] });
  });
});
