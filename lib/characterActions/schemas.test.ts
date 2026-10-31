import { describe, expect, it } from "vitest";
import { refreshChoiceSchema } from "./schemas";

describe("répondre à un choix rouvert (V3.1-119)", () => {
  it("une réponse ou « garder » ; rien d'autre ne passe", () => {
    expect(refreshChoiceSchema.safeParse({ campaignId: null, key: "circle-of-the-land.land", values: ["polar"] }).success).toBe(true);
    expect(refreshChoiceSchema.safeParse({ campaignId: null, key: "circle-of-the-land.land", values: null }).success).toBe(true);
    expect(refreshChoiceSchema.safeParse({ campaignId: null, key: "circle-of-the-land.land", values: [] }).success).toBe(false);
    expect(refreshChoiceSchema.safeParse({ campaignId: null, key: "x", values: null, choices: {} }).success).toBe(false);
  });
});
