import { describe, expect, it } from "vitest";
import { myInitiativeSchema } from "./schemas";

/** V3.1-103 — ce qu'une joueuse peut envoyer pour son initiative. */
describe("myInitiativeSchema", () => {
  it("accepte « lancer » et un d20 naturel", () => {
    expect(myInitiativeSchema.safeParse({ mode: "roll" }).success).toBe(true);
    expect(myInitiativeSchema.safeParse({ mode: "die", natural: 14, modifierIncluded: false }).success).toBe(true);
  });

  it("un total déjà annoncé peut dépasser 20, dans les bornes de la base", () => {
    expect(myInitiativeSchema.safeParse({ mode: "die", natural: 23, modifierIncluded: true }).success).toBe(true);
    expect(myInitiativeSchema.safeParse({ mode: "die", natural: 41, modifierIncluded: true }).success).toBe(false);
  });

  it("refuse un d20 naturel hors de 1 à 20, un mode inconnu ou une valeur imposée au jet du serveur", () => {
    expect(myInitiativeSchema.safeParse({ mode: "die", natural: 23, modifierIncluded: false }).success).toBe(false);
    expect(myInitiativeSchema.safeParse({ mode: "die", natural: 0, modifierIncluded: false }).success).toBe(false);
    expect(myInitiativeSchema.safeParse({ mode: "set", value: 30 }).success).toBe(false);
    const roll = myInitiativeSchema.safeParse({ mode: "roll", natural: 20 });
    expect(roll.success && "natural" in roll.data).toBe(false);
  });
});
