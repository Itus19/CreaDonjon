import { describe, expect, it } from "vitest";
import { BUILTIN_BACKGROUNDS } from "./builtinBackgrounds";
import {
  checkWikiBackgroundMode,
  chooseWikiBackground,
  publicationBackgroundState,
  retuneWorldWikiBackground,
  wikiBackgroundInputFromRef,
  worldWikiBackgroundView,
  zWikiBackgroundInput,
  zWorldWikiBackground,
} from "./worldWikiBackground";

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

describe("réglage de Publication (V3.1-60)", () => {
  const builtin = BUILTIN_BACKGROUNDS[0];

  it("un fond fourni redevient sa vignette dans la galerie", () => {
    expect(publicationBackgroundState({ source: "builtin", key: builtin.slug, mode: "dim", blur: 12 }, null)).toEqual({
      ref: `builtin:${builtin.slug}`,
      imageUrl: builtin.backdropUrl,
      hue: builtin.hue,
      chroma: builtin.chroma,
      availableModes: builtin.availableModes,
      mode: "dim",
      blur: 12,
    });
  });

  it("une copie n'a pas de vignette dans la bibliothèque, mais garde son image et ses modes", () => {
    const copie = { source: "world_asset" as const, assetId: "a1", mode: "dark" as const, blur: 8, hue: 40, chroma: 0.04, availableModes: ["dark" as const, "dim" as const] };
    expect(publicationBackgroundState(copie, "/image?v=a1")).toEqual({
      ref: null,
      imageUrl: "/image?v=a1",
      hue: 40,
      chroma: 0.04,
      availableModes: ["dark", "dim"],
      mode: "dark",
      blur: 8,
    });
  });

  it("aucun réglage, ou un fond fourni disparu : rien", () => {
    expect(publicationBackgroundState(null, null)).toBeNull();
    expect(publicationBackgroundState({ source: "builtin", key: "disparu", mode: "dark", blur: 0 }, null)).toBeNull();
  });

  it("une sélection de la galerie devient la requête du MJ", () => {
    expect(wikiBackgroundInputFromRef("builtin:artwork-c", "soft", 10)).toEqual({ source: "builtin", key: "artwork-c", mode: "soft", blur: 10 });
    const id = "6f1c1b5e-2d7a-4c1e-9b1a-0d2f3e4a5b6c";
    expect(wikiBackgroundInputFromRef(id, "dark", 0)).toEqual({ source: "library", backgroundImageId: id, mode: "dark", blur: 0 });
    expect(zWikiBackgroundInput.safeParse(wikiBackgroundInputFromRef(id, "dark", 0)).success).toBe(true);
  });
});

describe("garder le fond, changer le mode et le flou (V3.1-60)", () => {
  const copie = { source: "world_asset" as const, assetId: "a1", mode: "dark" as const, blur: 8, hue: 40, chroma: 0.04, availableModes: ["dark" as const, "dim" as const] };

  it("l'entrée accepte « keep » avec un mode et un flou", () => {
    expect(zWikiBackgroundInput.safeParse({ source: "keep", mode: "dim", blur: 10 }).success).toBe(true);
    expect(zWikiBackgroundInput.safeParse({ source: "keep", mode: "dim", blur: 41 }).success).toBe(false);
  });

  it("une copie garde son image : seuls le mode et le flou changent", () => {
    expect(retuneWorldWikiBackground(copie, "dim", 20)).toEqual({ ok: true, setting: { ...copie, mode: "dim", blur: 20 } });
  });

  it("un fond fourni aussi", () => {
    const setting = { source: "builtin" as const, key: fourni.slug, mode: "dark" as const, blur: 0 };
    expect(retuneWorldWikiBackground(setting, "light", 4)).toEqual({ ok: true, setting: { ...setting, mode: "light", blur: 4 } });
  });

  it("un mode que le fond ne permet pas est refusé ; sans fond, rien à garder", () => {
    expect(retuneWorldWikiBackground(copie, "light", 8)).toEqual({ ok: false, reason: "invalid_mode" });
    expect(retuneWorldWikiBackground(null, "dark", 8)).toEqual({ ok: false, reason: "not_found" });
    expect(retuneWorldWikiBackground({ source: "builtin", key: "disparu", mode: "dark", blur: 0 }, "dark", 8)).toEqual({ ok: false, reason: "not_found" });
  });
});
