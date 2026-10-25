import { describe, expect, it } from "vitest";
import { PERSONALITY_POLE_KEYS, WORLDVIEW_POLE_KEYS } from "@/src/core/psyche/keys";
import { poleBandLabel } from "@/src/core/psyche/poles";
import {
  PERSONALITY_POLES_FR,
  PERSONALITY_POLE_DESCRIPTIONS_FR,
  WORLDVIEW_POLES_FR,
  WORLDVIEW_POLE_DESCRIPTIONS_FR,
} from "./fr";

describe("table unique des libellés de pôles", () => {
  it("couvre chaque clé, et le titre cite les deux bouts", () => {
    for (const key of PERSONALITY_POLE_KEYS) {
      const p = PERSONALITY_POLES_FR[key];
      expect(p.label).toContain(p.positive.label);
      expect(p.label).toContain(p.negative.label);
    }
    for (const key of WORLDVIEW_POLE_KEYS) {
      const p = WORLDVIEW_POLES_FR[key];
      expect(p.label).toContain(p.positive.label);
      expect(p.label).toContain(p.negative.label);
    }
  });

  it("n'a plus de doublon « Prudence » entre curiosity_caution et impulse_prudence", () => {
    expect(PERSONALITY_POLES_FR.curiosity_caution.label).toBe("Circonspection ↔ Curiosité");
    expect(PERSONALITY_POLE_DESCRIPTIONS_FR.curiosity_caution).toContain("Circonspection");
    expect(PERSONALITY_POLE_DESCRIPTIONS_FR.curiosity_caution).not.toContain("Prudence");
  });

  it("renomme wealth_honor en « Profit ↔ Honneur », description comprise", () => {
    expect(WORLDVIEW_POLES_FR.wealth_honor.label).toBe("Profit ↔ Honneur");
    expect(WORLDVIEW_POLE_DESCRIPTIONS_FR.wealth_honor).toMatch(/^Profit :/);
  });

  it("accorde les exemples du ticket", () => {
    expect(poleBandLabel(PERSONALITY_POLES_FR.altruism_selfishness, 50)).toBe("Altruisme fort");
    expect(poleBandLabel(PERSONALITY_POLES_FR.empathy_hardness, -20)).toBe("Dureté légère");
    expect(poleBandLabel(PERSONALITY_POLES_FR.curiosity_caution, -100)).toBe("Circonspection extrême");
    expect(poleBandLabel(WORLDVIEW_POLES_FR.wealth_honor, -50)).toBe("Profit fort");
  });
});
