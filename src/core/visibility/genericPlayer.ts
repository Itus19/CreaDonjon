import type { Viewer } from "./types";

/**
 * Identifiant qui n'appartient à personne : ce qui est réservé à un compte
 * précis (`user`, `private`) ne lui revient jamais.
 */
const PERSONNE = "00000000-0000-0000-0000-000000000000";

/**
 * V3.1-78 — le lecteur « joueur générique » d'une campagne : ce que voit
 * n'importe quel joueur, sans les droits propres d'aucun. Sert à montrer au
 * MJ une carte telle que le serveur l'envoie à un joueur, sans emprunter le
 * compte de personne (« voir comme » de V3.1-12 bascule toute la session).
 * Sans campagne : un lecteur sans lien, qui ne voit que le public.
 */
export function genericPlayerViewer(campaignId: string | null): Viewer {
  return {
    kind: "user",
    userId: PERSONNE,
    worldRole: null,
    campaignRoles: campaignId ? { [campaignId]: "player" } : {},
  };
}
