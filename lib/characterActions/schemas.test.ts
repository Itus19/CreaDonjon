import { describe, expect, it } from "vitest";
import { applyLevelUpSchema, refreshChoiceSchema } from "./schemas";

describe("répondre à un choix rouvert (V3.1-119)", () => {
  it("une réponse ou « garder » ; rien d'autre ne passe", () => {
    expect(refreshChoiceSchema.safeParse({ campaignId: null, key: "circle-of-the-land.land", values: ["polar"] }).success).toBe(true);
    expect(refreshChoiceSchema.safeParse({ campaignId: null, key: "circle-of-the-land.land", values: null }).success).toBe(true);
    expect(refreshChoiceSchema.safeParse({ campaignId: null, key: "circle-of-the-land.land", values: [] }).success).toBe(false);
    expect(refreshChoiceSchema.safeParse({ campaignId: null, key: "x", values: null, choices: {} }).success).toBe(false);
  });
});

describe("applyLevelUpSchema — intentions de points de vie (V3.1-176)", () => {
  const hpChoices = applyLevelUpSchema.shape.hpChoices;
  it("accepte la moyenne, le jet et le maximum", () => {
    expect(hpChoices.safeParse({ ranger: ["average", "rolled", "max"] }).success).toBe(true);
  });
  it("refuse une valeur : le client n'envoie qu'une intention", () => {
    expect(hpChoices.safeParse({ ranger: [10] }).success).toBe(false);
    expect(hpChoices.safeParse({ ranger: ["maximum"] }).success).toBe(false);
  });
});
