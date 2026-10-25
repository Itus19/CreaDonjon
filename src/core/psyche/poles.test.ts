import { describe, expect, it } from "vitest";
import { poleBandLabel, type PoleEnds } from "./poles";

// Un pôle féminin à chaque bout (Circonspection ↔ Curiosité) et un masculin (Égoïsme ↔ Altruisme).
const CURIOSITE: PoleEnds = {
  positive: { label: "Curiosité", gender: "f" },
  negative: { label: "Circonspection", gender: "f" },
};
const ALTRUISME: PoleEnds = {
  positive: { label: "Altruisme", gender: "m" },
  negative: { label: "Égoïsme", gender: "m" },
};
const MIXTE: PoleEnds = {
  positive: { label: "Altruisme", gender: "m" },
  negative: { label: "Dureté", gender: "f" },
};

describe("poleBandLabel — les sept bandes", () => {
  it("pôle féminin : léger/légère → légère, forte, extrême", () => {
    expect(poleBandLabel(CURIOSITE, -100)).toBe("Circonspection extrême");
    expect(poleBandLabel(CURIOSITE, -50)).toBe("Circonspection forte");
    expect(poleBandLabel(CURIOSITE, -20)).toBe("Circonspection légère");
    expect(poleBandLabel(CURIOSITE, 0)).toBe("neutre — ne s'en soucie pas");
    expect(poleBandLabel(CURIOSITE, 20)).toBe("Curiosité légère");
    expect(poleBandLabel(CURIOSITE, 50)).toBe("Curiosité forte");
    expect(poleBandLabel(CURIOSITE, 100)).toBe("Curiosité extrême");
  });

  it("pôle masculin : léger, fort, extrême", () => {
    expect(poleBandLabel(ALTRUISME, -100)).toBe("Égoïsme extrême");
    expect(poleBandLabel(ALTRUISME, -50)).toBe("Égoïsme fort");
    expect(poleBandLabel(ALTRUISME, -20)).toBe("Égoïsme léger");
    expect(poleBandLabel(ALTRUISME, 20)).toBe("Altruisme léger");
    expect(poleBandLabel(ALTRUISME, 50)).toBe("Altruisme fort");
    expect(poleBandLabel(ALTRUISME, 100)).toBe("Altruisme extrême");
  });

  it("chaque côté s'accorde au genre de SON pôle", () => {
    expect(poleBandLabel(MIXTE, 40)).toBe("Altruisme fort");
    expect(poleBandLabel(MIXTE, -40)).toBe("Dureté forte");
    expect(poleBandLabel(MIXTE, -15)).toBe("Dureté légère");
  });
});

describe("poleBandLabel — bornes exactes des seuils (bandTierFor)", () => {
  it("bascule aux seuils -67/-66, -34/-33, -12/-11, 11/12, 33/34, 66/67", () => {
    expect(poleBandLabel(ALTRUISME, -67)).toBe("Égoïsme extrême");
    expect(poleBandLabel(ALTRUISME, -66)).toBe("Égoïsme fort");
    expect(poleBandLabel(ALTRUISME, -34)).toBe("Égoïsme fort");
    expect(poleBandLabel(ALTRUISME, -33)).toBe("Égoïsme léger");
    expect(poleBandLabel(ALTRUISME, -12)).toBe("Égoïsme léger");
    expect(poleBandLabel(ALTRUISME, -11)).toBe("neutre — ne s'en soucie pas");
    expect(poleBandLabel(ALTRUISME, 11)).toBe("neutre — ne s'en soucie pas");
    expect(poleBandLabel(ALTRUISME, 12)).toBe("Altruisme léger");
    expect(poleBandLabel(ALTRUISME, 33)).toBe("Altruisme léger");
    expect(poleBandLabel(ALTRUISME, 34)).toBe("Altruisme fort");
    expect(poleBandLabel(ALTRUISME, 66)).toBe("Altruisme fort");
    expect(poleBandLabel(ALTRUISME, 67)).toBe("Altruisme extrême");
  });
});
