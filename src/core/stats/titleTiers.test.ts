import { describe, expect, it } from "vitest";
import { zPlayerTitleTier, TITLE_ICON_KEYS, TITLE_TEMPLATE_VARIABLES, DEFAULT_TITLE_TIERS } from "./titleTiers";

describe("les paliers de titres (V3.1-89, données réglables)", () => {
  it("douze icônes du code", () => {
    expect(TITLE_ICON_KEYS).toHaveLength(12);
  });
  it("chaque palier par défaut est valide", () => {
    for (const tier of DEFAULT_TITLE_TIERS) expect(zPlayerTitleTier.safeParse(tier).success, tier.name).toBe(true);
  });
  it("refuse une icône ou une couleur inconnue", () => {
    const base = DEFAULT_TITLE_TIERS[0];
    expect(zPlayerTitleTier.safeParse({ ...base, icon_key: "fusee" }).success).toBe(false);
    expect(zPlayerTitleTier.safeParse({ ...base, color_token: "rose" }).success).toBe(false);
  });
  it("refuse une variable de texte inconnue", () => {
    const base = DEFAULT_TITLE_TIERS[0];
    expect(zPlayerTitleTier.safeParse({ ...base, template: "{n20} et {inconnue}" }).success).toBe(false);
    expect(TITLE_TEMPLATE_VARIABLES).toContain("n20");
  });
  it("une famille chiffrée a une plage ; l'action favorite a une nature d'action", () => {
    const luck = DEFAULT_TITLE_TIERS.find((t) => t.family === "luck")!;
    expect(zPlayerTitleTier.safeParse({ ...luck, range_from: null }).success).toBe(false);
    const fav = DEFAULT_TITLE_TIERS.find((t) => t.family === "favorite_action")!;
    expect(zPlayerTitleTier.safeParse({ ...fav, action_kind: null }).success).toBe(false);
  });
  it("les quatre familles ont leurs paliers par défaut", () => {
    const families = new Set(DEFAULT_TITLE_TIERS.map((t) => t.family));
    expect([...families].sort()).toEqual(["bad_luck", "favorite_action", "luck", "purse"]);
  });
});
