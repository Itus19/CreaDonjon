import { describe, expect, it } from "vitest";
import { canSee } from "./canSee";
import { genericPlayerViewer } from "./genericPlayer";

/**
 * V3.1-78 — « Voir comme les joueurs » sur une carte : le lecteur joueur
 * générique voit ce que voit n'importe quel joueur de la campagne, et rien de
 * ce qui ne vaut que pour une personne précise.
 */
describe("genericPlayerViewer", () => {
  const joueur = genericPlayerViewer("campagne-a");

  it("voit le public, ce qui va aux joueurs et à sa campagne", () => {
    expect(canSee({ level: "public", scopeId: null, createdBy: "mj" }, joueur)).toBe(true);
    expect(canSee({ level: "players", scopeId: null, createdBy: "mj" }, joueur)).toBe(true);
    // Le niveau `campaign` se lit depuis sa campagne (contexte de lecture, comme la route des zones).
    expect(canSee({ level: "campaign", scopeId: "campagne-a", createdBy: "mj" }, joueur, { campaignId: "campagne-a" })).toBe(true);
  });

  it("ne voit ni le MJ, ni une autre campagne, ni ce qui est réservé à une personne", () => {
    expect(canSee({ level: "gm", scopeId: null, createdBy: "mj" }, joueur)).toBe(false);
    expect(canSee({ level: "campaign", scopeId: "campagne-b", createdBy: "mj" }, joueur, { campaignId: "campagne-a" })).toBe(false);
    expect(canSee({ level: "user", scopeId: "une-joueuse", createdBy: "mj" }, joueur)).toBe(false);
    expect(canSee({ level: "private", scopeId: null, createdBy: "mj" }, joueur)).toBe(false);
  });

  it("sans campagne, ne voit que le public", () => {
    const seul = genericPlayerViewer(null);
    expect(canSee({ level: "public", scopeId: null, createdBy: "mj" }, seul)).toBe(true);
    expect(canSee({ level: "players", scopeId: null, createdBy: "mj" }, seul)).toBe(false);
  });
});
