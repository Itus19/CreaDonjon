import { describe, expect, it } from "vitest";
import { creatureTypeOf, isValidTarget, type TargetProfile } from "./targetRestriction";
import { zEffectData } from "../schemas/rule-blocks/blocks";

/** V3.1-110 (ADR 0044) — qui un effet peut viser, avant toute demande de sauvegarde. */
const charmPerson = { id: "e1", target: { creature_types: ["humanoid"], immune_conditions_block: ["charmed"] } };
const healing = { id: "e1", target: { exclude_creature_types: ["undead", "construct"] } };

const humanoid: TargetProfile = { creatureType: "humanoid", conditionImmunities: [] };
const zombie: TargetProfile = { creatureType: "undead", conditionImmunities: ["poisoned"] };
const elfImmune: TargetProfile = { creatureType: "humanoid", conditionImmunities: ["charmed"] };

describe("isValidTarget", () => {
  it("Charme-personne sur un humanoïde : accepté", () => {
    expect(isValidTarget(charmPerson, humanoid)).toEqual({ ok: true });
  });

  it("Charme-personne sur un mort-vivant : refusé, et dit pourquoi", () => {
    expect(isValidTarget(charmPerson, zombie)).toEqual({ ok: false, reason: "creature_type_not_allowed", detail: "undead" });
  });

  it("Charme-personne sur un humanoïde immunisé à Charmé : refusé", () => {
    expect(isValidTarget(charmPerson, elfImmune)).toEqual({ ok: false, reason: "condition_immunity", detail: "charmed" });
  });

  it("un type exclu : refusé (soins 2014 sur un mort-vivant)", () => {
    expect(isValidTarget(healing, zombie)).toEqual({ ok: false, reason: "creature_type_excluded", detail: "undead" });
    expect(isValidTarget(healing, humanoid)).toEqual({ ok: true });
  });

  it("sans restriction, toute cible est valide", () => {
    const bare: { id: string; target?: undefined } = { id: "e1" };
    expect(isValidTarget(bare, zombie)).toEqual({ ok: true });
  });

  it("type de créature inconnu (saisie libre) : on ne refuse pas sans savoir, sauf immunité connue", () => {
    expect(isValidTarget(charmPerson, { creatureType: null, conditionImmunities: [] })).toEqual({ ok: true });
    expect(isValidTarget(charmPerson, { creatureType: null, conditionImmunities: ["Charmed"] })).toEqual({
      ok: false,
      reason: "condition_immunity",
      detail: "charmed",
    });
  });
});

describe("creatureTypeOf", () => {
  it("le premier mot, en minuscules, sans sous-type", () => {
    expect(creatureTypeOf("Humanoid (goblinoid)")).toBe("humanoid");
    expect(creatureTypeOf("undead")).toBe("undead");
    expect(creatureTypeOf("  Swarm of Tiny beasts ")).toBe("swarm");
    expect(creatureTypeOf("")).toBeNull();
  });
});

describe("zEffectData.target", () => {
  it("accepte une restriction complète et refuse un type vide", () => {
    expect(zEffectData.safeParse(charmPerson).success).toBe(true);
    expect(zEffectData.safeParse({ id: "e1", target: { creature_types: [""] } }).success).toBe(false);
  });
});
