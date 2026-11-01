import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { zPlayerTitleTierSet } = await import("./playerTitleTiersWrite");
const { DEFAULT_TITLE_TIERS } = await import("@/src/core/stats/titleTiers");

describe("le jeu de paliers que l'éditeur envoie (V3.1-92)", () => {
  it("les paliers par défaut passent", () => {
    expect(zPlayerTitleTierSet.safeParse(DEFAULT_TITLE_TIERS).success).toBe(true);
  });

  it("une icône ou une couleur hors liste est refusée", () => {
    expect(zPlayerTitleTierSet.safeParse(DEFAULT_TITLE_TIERS.map((t, i) => (i === 0 ? { ...t, icon_key: "fusee" } : t))).success).toBe(false);
    expect(zPlayerTitleTierSet.safeParse(DEFAULT_TITLE_TIERS.map((t, i) => (i === 0 ? { ...t, color_token: "#ff00ff" } : t))).success).toBe(false);
  });

  it("une famille sans aucun palier est refusée, et un jeu vide", () => {
    expect(zPlayerTitleTierSet.safeParse(DEFAULT_TITLE_TIERS.filter((t) => t.family !== "purse")).success).toBe(false);
    expect(zPlayerTitleTierSet.safeParse([]).success).toBe(false);
  });

  it("le petit texte reste du texte : une variable inconnue est refusée, du HTML est une simple chaîne", () => {
    expect(zPlayerTitleTierSet.safeParse(DEFAULT_TITLE_TIERS.map((t, i) => (i === 0 ? { ...t, template: "{script}" } : t))).success).toBe(false);
    const html = zPlayerTitleTierSet.safeParse(DEFAULT_TITLE_TIERS.map((t, i) => (i === 0 ? { ...t, template: "<img src=x onerror=alert(1)> {n20}" } : t)));
    expect(html.success).toBe(true);
  });
});
