import { describe, expect, it } from "vitest";
import { bandTierFor, relationshipAxisLabel, relationshipSummary, RELATIONSHIP_AXIS_BAND_LABELS_FR } from "./bands";
import { RELATIONSHIP_AXIS_KEYS } from "./keys";

describe("bandTierFor", () => {
  it("respecte les seuils exacts de la spec (specs/psyche-pnj.md §1.5)", () => {
    expect(bandTierFor(-100)).toBe("extreme_neg");
    expect(bandTierFor(-67)).toBe("extreme_neg");
    expect(bandTierFor(-66)).toBe("strong_neg");
    expect(bandTierFor(-34)).toBe("strong_neg");
    expect(bandTierFor(-33)).toBe("slight_neg");
    expect(bandTierFor(-12)).toBe("slight_neg");
    expect(bandTierFor(-11)).toBe("neutral");
    expect(bandTierFor(0)).toBe("neutral");
    expect(bandTierFor(11)).toBe("neutral");
    expect(bandTierFor(12)).toBe("slight_pos");
    expect(bandTierFor(33)).toBe("slight_pos");
    expect(bandTierFor(34)).toBe("strong_pos");
    expect(bandTierFor(66)).toBe("strong_pos");
    expect(bandTierFor(67)).toBe("extreme_pos");
    expect(bandTierFor(100)).toBe("extreme_pos");
  });
});

describe("relationshipAxisLabel", () => {
  it("suit l'exemple de la spec pour trust_distrust", () => {
    expect(relationshipAxisLabel("trust_distrust", -80)).toBe("convaincu de sa duplicité");
    expect(relationshipAxisLabel("trust_distrust", -50)).toBe("méfiant");
    expect(relationshipAxisLabel("trust_distrust", 0)).toBe("neutre");
    expect(relationshipAxisLabel("trust_distrust", 50)).toBe("confiant");
    expect(relationshipAxisLabel("trust_distrust", 80)).toBe("aveugle");
  });

  it("definit les sept bandes pour chacun des sept axes", () => {
    for (const axis of RELATIONSHIP_AXIS_KEYS) {
      for (const tier of Object.keys(RELATIONSHIP_AXIS_BAND_LABELS_FR[axis])) {
        expect(RELATIONSHIP_AXIS_BAND_LABELS_FR[axis][tier as keyof typeof RELATIONSHIP_AXIS_BAND_LABELS_FR.trust_distrust]).toBeTruthy();
      }
    }
  });
});

describe("relationshipSummary", () => {
  it("dit « rien de marquant » quand aucun axe n'est à ±2 ou ±3", () => {
    expect(relationshipSummary({})).toBe("rien de marquant");
    expect(relationshipSummary({ trust_distrust: 30, friendship_hostility: -30, respect_contempt: 0 })).toBe("rien de marquant");
  });

  it("donne le mot d'un seul axe marquant", () => {
    expect(relationshipSummary({ trust_distrust: 50, friendship_hostility: 10 })).toBe("confiant");
  });

  it("garde les bandes ±2 et ±3 aux bornes exactes", () => {
    expect(relationshipSummary({ trust_distrust: 33 })).toBe("rien de marquant");
    expect(relationshipSummary({ trust_distrust: 34 })).toBe("confiant");
    expect(relationshipSummary({ trust_distrust: -34 })).toBe("méfiant");
    expect(relationshipSummary({ trust_distrust: -33 })).toBe("rien de marquant");
  });

  it("énumère « a, b et c » dans l'ordre des axes, pas de la saisie", () => {
    expect(
      relationshipSummary({
        debt_independence: 50,
        respect_contempt: 50,
        friendship_hostility: 50,
        trust_distrust: 90,
      }),
    ).toBe("aveugle, amical, admiratif et obligé");
  });

  it("deux mots : « a et b »", () => {
    expect(relationshipSummary({ trust_distrust: -50, fear_assurance: 90 })).toBe("méfiant et terrifié");
  });
});
