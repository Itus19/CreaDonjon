import { describe, expect, it } from "vitest";
import { canSee } from "./canSee";
import { asSoloPlayer } from "./soloPlayer";
import type { Viewer } from "./types";

const MOI = "11111111-1111-1111-1111-111111111111";
const PARTIE = "22222222-2222-2222-2222-222222222222";
const proprietaire: Viewer = { kind: "user", userId: MOI, worldRole: "owner", campaignRoles: {} };

describe("asSoloPlayer — V3.2-51, le wiki d'une partie solo se lit en vue joueur", () => {
  const joueur = asSoloPlayer(proprietaire, PARTIE);

  it("le propriétaire ne voit plus ce qui est réservé au MJ", () => {
    expect(canSee({ level: "gm", scopeId: null, createdBy: MOI }, proprietaire, {})).toBe(true);
    expect(canSee({ level: "gm", scopeId: null, createdBy: MOI }, joueur, { campaignId: PARTIE })).toBe(false);
  });

  it("il voit ce que voit un joueur de la partie, et ce qui n'est qu'à lui", () => {
    expect(canSee({ level: "players", scopeId: null, createdBy: null }, joueur, { campaignId: PARTIE })).toBe(true);
    expect(canSee({ level: "campaign", scopeId: PARTIE, createdBy: null }, joueur, { campaignId: PARTIE })).toBe(true);
    expect(canSee({ level: "user", scopeId: MOI, createdBy: null }, joueur, { campaignId: PARTIE })).toBe(true);
    expect(canSee({ level: "private", scopeId: null, createdBy: MOI }, joueur, { campaignId: PARTIE })).toBe(true);
  });

  it("un lecteur qui n'est ni propriétaire ni éditeur ne change pas, ni un anonyme", () => {
    const simple: Viewer = { kind: "user", userId: MOI, worldRole: "viewer", campaignRoles: { [PARTIE]: "player" } };
    expect(asSoloPlayer(simple, PARTIE)).toBe(simple);
    expect(asSoloPlayer({ kind: "anonymous" }, PARTIE)).toEqual({ kind: "anonymous" });
  });
});
