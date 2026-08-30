import { describe, expect, it } from "vitest";
import { canEditEntity, type CanEditEntityContext } from "./canEditEntity";
import type { Viewer } from "@/src/core/visibility/types";

const NEITHER: CanEditEntityContext = { isOwnCharacter: false, isGranted: false };
const OWN_CHARACTER: CanEditEntityContext = { isOwnCharacter: true, isGranted: false };
const GRANTED: CanEditEntityContext = { isOwnCharacter: false, isGranted: true };

function viewer(partial: Partial<Extract<Viewer, { kind: "user" }>> = {}): Viewer {
  return { kind: "user", userId: "u1", worldRole: null, campaignRoles: {}, ...partial };
}

describe("canEditEntity — table de verite (V2-M3, Lot M)", () => {
  it("un visiteur anonyme n'ecrit jamais, quel que soit le contexte", () => {
    expect(canEditEntity({ kind: "anonymous" }, NEITHER)).toBe(false);
    expect(canEditEntity({ kind: "anonymous" }, OWN_CHARACTER)).toBe(false);
    expect(canEditEntity({ kind: "anonymous" }, GRANTED)).toBe(false);
  });

  it("proprietaire ou editeur du monde ecrit toujours, meme sans lien avec l'entite", () => {
    expect(canEditEntity(viewer({ worldRole: "owner" }), NEITHER)).toBe(true);
    expect(canEditEntity(viewer({ worldRole: "editor" }), NEITHER)).toBe(true);
  });

  it("simple 'viewer' du monde, sans campagne ni octroi, n'ecrit pas", () => {
    expect(canEditEntity(viewer({ worldRole: "viewer" }), NEITHER)).toBe(false);
  });

  it("MJ d'une campagne du monde ecrit toujours, meme sans role de monde (invitation par email existante)", () => {
    expect(canEditEntity(viewer({ worldRole: null, campaignRoles: { c1: "gm" } }), NEITHER)).toBe(true);
  });

  it("un simple joueur n'ecrit que sa propre fiche PJ ou une fiche accordee", () => {
    const player = viewer({ worldRole: null, campaignRoles: { c1: "player" } });
    expect(canEditEntity(player, NEITHER)).toBe(false);
    expect(canEditEntity(player, OWN_CHARACTER)).toBe(true);
    expect(canEditEntity(player, GRANTED)).toBe(true);
  });

  it("un utilisateur sans aucun role de monde ni de campagne peut quand meme ecrire via sa fiche PJ ou un octroi", () => {
    expect(canEditEntity(viewer(), OWN_CHARACTER)).toBe(true);
    expect(canEditEntity(viewer(), GRANTED)).toBe(true);
    expect(canEditEntity(viewer(), NEITHER)).toBe(false);
  });
});
