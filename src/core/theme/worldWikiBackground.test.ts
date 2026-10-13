import { describe, expect, it } from "vitest";
import { BUILTIN_BACKGROUNDS } from "./builtinBackgrounds";
import { checkWikiBackgroundMode, chooseWikiBackground, worldWikiBackgroundView, zWikiBackgroundInput, zWorldWikiBackground } from "./worldWikiBackground";

const fourni = BUILTIN_BACKGROUNDS[0];

describe("fond par défaut du wiki (V3.1-59, ADR 0047)", () => {
  it("l'entrée accepte un fond fourni, une image de la bibliothèque, ou aucun fond", () => {
    expect(zWikiBackgroundInput.safeParse({ source: "builtin", key: fourni.slug, mode: "dark", blur: 20 }).success).toBe(true);
    expect(zWikiBackgroundInput.safeParse({ source: "library", backgroundImageId: "11111111-1111-4111-8111-111111111111", mode: "dim", blur: 0 }).success).toBe(true);
    expect(zWikiBackgroundInput.safeParse({ source: "none" }).success).toBe(true);
  });

  it("le flou va de 0 à 40, entier", () => {
    expect(zWikiBackgroundInput.safeParse({ source: "builtin", key: fourni.slug, mode: "dark", blur: 41 }).success).toBe(false);
    expect(zWikiBackgroundInput.safeParse({ source: "builtin", key: fourni.slug, mode: "dark", blur: -1 }).success).toBe(false);
    expect(zWikiBackgroundInput.safeParse({ source: "builtin", key: fourni.slug, mode: "dark", blur: 2.5 }).success).toBe(false);
  });

  it("le mode doit être l'un de ceux que le fond permet", () => {
    expect(checkWikiBackgroundMode("dim", ["dark", "dim"])).toBe(true);
    expect(checkWikiBackgroundMode("light", ["dark", "dim"])).toBe(false);
  });

  it("un fond fourni se résout vers son image publique, sa teinte et le mode choisi", () => {
    const view = worldWikiBackgroundView({ source: "builtin", key: fourni.slug, mode: "dim", blur: 12 }, null);
    expect(view).toEqual({ imageUrl: fourni.backdropUrl, blurPx: 12, fadeMs: 600, hue: fourni.hue, chroma: fourni.chroma, mode: "dim" });
  });

  it("une copie dans le monde se résout vers l'adresse donnée par l'appelant", () => {
    const view = worldWikiBackgroundView(
      { source: "world_asset", assetId: "a", mode: "light", blur: 0, hue: 120, chroma: 0.04, availableModes: ["dark", "light"] },
      "/partage/jeton/fond-du-wiki"
    );
    expect(view).toEqual({ imageUrl: "/partage/jeton/fond-du-wiki", blurPx: 0, fadeMs: 600, hue: 120, chroma: 0.04, mode: "light" });
  });

  it("aucun fond, un fond fourni disparu, ou une copie sans adresse : rien", () => {
    expect(worldWikiBackgroundView(null, null)).toBeNull();
    expect(worldWikiBackgroundView({ source: "builtin", key: "disparu", mode: "dark", blur: 20 }, null)).toBeNull();
    expect(worldWikiBackgroundView({ source: "world_asset", assetId: "a", mode: "dark", blur: 20, hue: 1, chroma: 0, availableModes: ["dark"] }, null)).toBeNull();
  });

  it("un réglage stocké illisible se relit comme « aucun fond »", () => {
    expect(zWorldWikiBackground.safeParse({ source: "inconnu" }).success).toBe(false);
  });
});

describe("chooseWikiBackground", () => {
  it("une fiche qui a son propre fond le garde ; sinon le fond du monde ; sinon rien", () => {
    expect(chooseWikiBackground("fiche", "monde")).toBe("fiche");
    expect(chooseWikiBackground(null, "monde")).toBe("monde");
    expect(chooseWikiBackground(null, null)).toBeNull();
  });
});
