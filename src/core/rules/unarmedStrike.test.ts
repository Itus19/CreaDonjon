import { describe, expect, it } from "vitest";
import { UNARMED_ACTION_ID, UNARMED_TERMS_FR, unarmedStrike } from "./unarmedStrike";

describe("unarmedStrike (SRD 5.2, Frappe à mains nues)", () => {
  it("attaque : modificateur de Force + bonus de maîtrise", () => {
    expect(unarmedStrike({ strMod: 3, proficiencyBonus: 2 }).attackModifier).toBe(5);
  });

  it("dégâts : 1 + modificateur de Force, contondants, sans dé", () => {
    expect(unarmedStrike({ strMod: 3, proficiencyBonus: 2 })).toMatchObject({ damage: 4, damageType: "bludgeoning" });
  });

  it("une Force faible ne rend jamais les dégâts négatifs", () => {
    expect(unarmedStrike({ strMod: -2, proficiencyBonus: 2 }).damage).toBe(0);
  });

  it("un identifiant d'action stable et des mots pour la reconnaître", () => {
    expect(UNARMED_ACTION_ID).toBe("unarmed");
    expect(UNARMED_TERMS_FR).toContain("poing");
  });
});
