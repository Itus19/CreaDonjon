import type { RemoteError } from "@/src/server/services/remotePlay";

/**
 * Le jeu à distance (ADR 0103) : une raison du service, un statut HTTP et
 * une phrase pour l'écran. « Refusé » (403) passe avant « introuvable »
 * quand l'appelant n'est pas de la table (SECURITE.md §2) : le service
 * vérifie l'appartenance avant de chercher l'objet.
 */
export const REMOTE_ERRORS: Record<RemoteError, { status: number; error: string }> = {
  not_found: { status: 404, error: "Campagne ou demande introuvable." },
  forbidden: { status: 403, error: "Ce geste n'est pas permis ici." },
  not_remote: { status: 409, error: "Cette campagne ne se joue pas à distance." },
  invalid_target: { status: 400, error: "Destinataire invalide." },
  refused: { status: 409, error: "Cette demande n'attend plus de réponse de ta part." },
  no_sheet: { status: 422, error: "Aucune fiche pour calculer ce jet." },
};
