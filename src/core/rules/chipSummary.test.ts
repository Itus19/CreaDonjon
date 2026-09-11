import { describe, it, expect } from "vitest";
import { chipSummaryFromDescription, CHIP_SUMMARY_MAX_LENGTH } from "./chipSummary";

describe("chipSummaryFromDescription", () => {
  it("prend le premier segment non vide", () => {
    const data = { segments: [{ text: "" }, { text: "Vous voyez dans le noir." }, { text: "Second paragraphe." }] };
    expect(chipSummaryFromDescription(data)).toBe("Vous voyez dans le noir.");
  });

  it("normalise les espaces et les retours a la ligne du segment", () => {
    const data = { segments: [{ text: "  Vision\ndans   le noir.  " }] };
    expect(chipSummaryFromDescription(data)).toBe("Vision dans le noir.");
  });

  it("tronque sur une frontiere de mot, jamais au milieu", () => {
    const long = "Aptitude ".repeat(60);
    const summary = chipSummaryFromDescription({ segments: [{ text: long }] });
    if (summary === null) throw new Error("resume inattendu : null");
    expect(summary.length).toBeLessThanOrEqual(CHIP_SUMMARY_MAX_LENGTH + 1);
    expect(summary.endsWith("…")).toBe(true);
    expect(summary).not.toMatch(/Aptitu…$/);
  });

  it("ne tronque pas un texte deja assez court", () => {
    const summary = chipSummaryFromDescription({ segments: [{ text: "Court." }] });
    expect(summary).toBe("Court.");
  });

  // Une traduction absente, un bloc d'un autre type ou une prose vide doivent
  // rendre la main a l'appelant (repli sur `ai_digest`), jamais une chaine vide
  // qui remplacerait un resume existant par du blanc.
  it("rend null sur une donnee inexploitable", () => {
    expect(chipSummaryFromDescription(undefined)).toBeNull();
    expect(chipSummaryFromDescription(null)).toBeNull();
    expect(chipSummaryFromDescription({})).toBeNull();
    expect(chipSummaryFromDescription({ segments: [] })).toBeNull();
    expect(chipSummaryFromDescription({ segments: [{ text: "   " }] })).toBeNull();
    expect(chipSummaryFromDescription({ level: 3, school: "Evocation" })).toBeNull();
    expect(chipSummaryFromDescription("Vision dans le noir.")).toBeNull();
  });
});
