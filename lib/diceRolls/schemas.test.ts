import { describe, expect, it } from "vitest";
import { freeformRollSchema } from "./schemas";
import { heroicRerollSchema } from "../characterActions/schemas";

describe("entrée de l'outil de dés (V3.1-33)", () => {
  it("l'ancienne forme reste valide, avec les valeurs par défaut", () => {
    expect(freeformRollSchema.parse({ pool: { d6: 2 }, hidden: false })).toEqual({
      pool: { d6: 2 },
      hidden: false,
      modifier: 0,
      advantage: "normal",
      label: null,
      dc: null,
      dcPrivate: false,
    });
  });
  it("le client n'envoie jamais un résultat : tout champ inconnu est refusé", () => {
    expect(freeformRollSchema.safeParse({ pool: { d20: 1 }, hidden: false, total: 20 }).success).toBe(false);
    expect(freeformRollSchema.safeParse({ pool: { d20: 1 }, hidden: false, rolls: [20] }).success).toBe(false);
  });
  it("avantage : un seul d20 dans la réserve", () => {
    expect(freeformRollSchema.safeParse({ pool: { d20: 1 }, hidden: false, advantage: "advantage" }).success).toBe(true);
    expect(freeformRollSchema.safeParse({ pool: { d20: 2 }, hidden: false, advantage: "advantage" }).success).toBe(false);
    expect(freeformRollSchema.safeParse({ pool: { d6: 1 }, hidden: false, advantage: "disadvantage" }).success).toBe(false);
  });
  it("bornes du modificateur, du DD et du libellé", () => {
    expect(freeformRollSchema.safeParse({ pool: { d20: 1 }, hidden: false, modifier: 100 }).success).toBe(false);
    expect(freeformRollSchema.safeParse({ pool: { d20: 1 }, hidden: false, dc: 0 }).success).toBe(false);
    expect(freeformRollSchema.safeParse({ pool: { d20: 1 }, hidden: false, label: "x".repeat(81) }).success).toBe(false);
  });
  it("une réserve vide est refusée", () => {
    expect(freeformRollSchema.safeParse({ pool: {}, hidden: false }).success).toBe(false);
  });
});

describe("relance par l'Inspiration héroïque (V3.1-33)", () => {
  const base = { campaignId: "00000000-0000-4000-8000-000000000001", advantage: "normal", dc: 15, hidden: false };
  it("un test de compétence, de caractéristique ou une sauvegarde", () => {
    expect(heroicRerollSchema.safeParse({ ...base, check: { kind: "skill", skill: "stealth" } }).success).toBe(true);
    expect(heroicRerollSchema.safeParse({ ...base, check: { kind: "save", ability: "wis" } }).success).toBe(true);
  });
  it("sans DD, ou hors campagne : refusé", () => {
    expect(heroicRerollSchema.safeParse({ ...base, dc: null, check: { kind: "ability", ability: "str" } }).success).toBe(false);
    expect(heroicRerollSchema.safeParse({ ...base, campaignId: null, check: { kind: "ability", ability: "str" } }).success).toBe(false);
  });
});
