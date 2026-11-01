import type { PlayerStatsView } from "@/src/server/services/playerStats";

export type PorteeStats = "campaign" | "last_session";

/**
 * V3.1-91 — L'appel des statistiques de la joueuse, sorti du composant (même
 * motif que `initiativeApi.ts`). Une seule requête par affichage du volet et
 * par changement de pilule (docs/QUOTAS.md Q1). Le serveur résout le
 * personnage de la joueuse : aucun identifiant de personnage n'est envoyé.
 * Lève une erreur si le serveur refuse ; une panne réseau se propage aussi,
 * l'appelant affiche un message.
 */
export async function chargerStatsJoueurApi(campaignId: string, portee: PorteeStats): Promise<PlayerStatsView> {
  const res = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}/player-stats?scope=${portee}`);
  if (!res.ok) throw new Error(`Statistiques indisponibles (${res.status}).`);
  return (await res.json()) as PlayerStatsView;
}
