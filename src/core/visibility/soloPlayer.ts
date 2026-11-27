import type { Viewer } from "./types";

/**
 * V3.2-51 (ADR 0118 §7) — En partie solo, la personne qui joue est
 * propriétaire du monde : son lecteur réel voit tout, secrets compris. Le
 * wiki de la partie doit pourtant refléter ce que son personnage sait (le
 * brouillard de guerre de l'ADR 0117). Ce lecteur garde son identité (ce qui
 * est à elle seule reste visible) mais perd ses droits de MJ : il lit comme
 * un joueur de la partie. Les écrans du MJ gardent le lecteur réel.
 */
export function asSoloPlayer(viewer: Viewer, campaignId: string): Viewer {
  if (viewer.kind !== "user" || (viewer.worldRole !== "owner" && viewer.worldRole !== "editor")) return viewer;
  return { kind: "user", userId: viewer.userId, worldRole: null, campaignRoles: { ...viewer.campaignRoles, [campaignId]: "player" } };
}
