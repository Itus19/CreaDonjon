import { describe, expect, it } from "vitest";
import { champsMonstre } from "./champsMonstre";

describe("champsMonstre (AG-1)", () => {
  it("lit d'abord les données d'import du SRD", () => {
    expect(champsMonstre({ challenge_rating: 0.25, xp: 50, type: "humanoid", size: "Small" }, null)).toEqual({
      challengeRating: 0.25,
      xp: 50,
      type: "humanoid",
      size: "Small",
    });
  });

  it("à défaut, lit le bloc de statistiques d'un monstre saisi à la main", () => {
    expect(champsMonstre(null, { challenge_rating: 11, xp: 7200, creature_type: "Élémentaire", size: "G" })).toEqual({
      challengeRating: 11,
      xp: 7200,
      type: "Élémentaire",
      size: "G",
    });
  });

  it("un bloc sans PX garde son FP, et dit que les PX manquent", () => {
    expect(champsMonstre({}, { challenge_rating: 2, creature_type: "Bête", size: "M" })).toEqual({
      challengeRating: 2,
      xp: null,
      type: "Bête",
      size: "M",
    });
  });

  it("sans FP nulle part, ce n'est pas un monstre utilisable", () => {
    expect(champsMonstre(null, null)).toBeNull();
    expect(champsMonstre({ xp: 50 }, { size: "M" })).toBeNull();
    expect(champsMonstre("texte", 42)).toBeNull();
  });
});
