import { describe, expect, it } from "vitest";
import { availableModesFor, deriveHueChroma, MAX_CHROMA, oklchToRgb, rgbToOklch, THEME_MODES } from "./oklch";

describe("rgbToOklch / oklchToRgb", () => {
  it("blanc pur : L proche de 1, chroma proche de 0", () => {
    const { l, c } = rgbToOklch({ r: 255, g: 255, b: 255 });
    expect(l).toBeCloseTo(1, 2);
    expect(c).toBeCloseTo(0, 2);
  });

  it("noir pur : L proche de 0, chroma proche de 0", () => {
    const { l, c } = rgbToOklch({ r: 0, g: 0, b: 0 });
    expect(l).toBeCloseTo(0, 2);
    expect(c).toBeCloseTo(0, 2);
  });

  it("aller-retour RVB -> OKLCH -> RVB reproduit la couleur d'origine a quelques unites pres (0-255)", () => {
    const original = { r: 120, g: 60, b: 200 };
    const oklch = rgbToOklch(original);
    const roundTripped = oklchToRgb(oklch);
    expect(Math.abs(roundTripped.r - original.r)).toBeLessThanOrEqual(2);
    expect(Math.abs(roundTripped.g - original.g)).toBeLessThanOrEqual(2);
    expect(Math.abs(roundTripped.b - original.b)).toBeLessThanOrEqual(2);
  });
});

describe("deriveHueChroma", () => {
  it("plafonne le chroma a MAX_CHROMA meme pour une couleur tres saturee", () => {
    const { chroma } = deriveHueChroma({ r: 255, g: 0, b: 0 }); // rouge pur, chroma OKLCH natif tres au-dessus du plafond
    expect(chroma).toBeLessThanOrEqual(MAX_CHROMA);
  });

  it("une couleur quasi neutre donne un chroma tres faible, sans depasser le plafond", () => {
    const { chroma } = deriveHueChroma({ r: 130, g: 128, b: 132 });
    expect(chroma).toBeGreaterThanOrEqual(0);
    expect(chroma).toBeLessThanOrEqual(MAX_CHROMA);
  });

  it("la teinte reste dans [0, 360)", () => {
    const { hue } = deriveHueChroma({ r: 40, g: 200, b: 90 });
    expect(hue).toBeGreaterThanOrEqual(0);
    expect(hue).toBeLessThan(360);
  });
});

describe("availableModesFor", () => {
  it("au chroma plafonne courant, les quatre modes restent lisibles pour n'importe quelle teinte (memes L que tokens.css, deja verifiees >= 7:1)", () => {
    for (const hue of [0, 78, 152, 200, 295]) {
      expect(availableModesFor(hue, MAX_CHROMA)).toEqual(THEME_MODES);
    }
  });

  it("meme a un chroma tres au-dela du plafond reel, les quatre modes restent lisibles — confirme que --h/--c ne pilotent jamais la clarte des surfaces (tokens.css), la garantie que ce controle est cense verifier plutot qu'un cas ou il doit echouer", () => {
    for (const hue of [0, 78, 152, 200, 295]) {
      expect(availableModesFor(hue, 0.4)).toEqual(THEME_MODES);
    }
  });
});
