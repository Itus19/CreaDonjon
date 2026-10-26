import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { genericPlayerViewer, type Viewer } from "@/src/core/visibility";
import { resolveCampaignId } from "@/src/server/services/campaigns";
import { isWorldAdmin } from "@/src/server/services/permissions";
import { buildViewerForWorld } from "@/src/server/services/visibility";

type TypedClient = SupabaseClient<Database>;

/**
 * V3.1-78 — le lecteur d'une carte (punaises, zones, couches). Par défaut,
 * le lecteur lui-même. Avec « Voir comme les joueurs », le lecteur joueur
 * générique de la campagne : le serveur rend la carte telle qu'il l'envoie à
 * un joueur — les éléments MJ sont absents du flux, pas masqués à l'écran.
 *
 * Réservé au MJ : le MJ voit déjà tout, la vue joueurs ne lui montre qu'un
 * sous-ensemble. Un membre du monde qui n'est pas d'une campagne y gagnerait
 * au contraire le niveau `players` : refusé (`null`).
 */
export async function resolveMapViewer(
  supabase: TypedClient,
  params: { worldId: string; userId: string; vueJoueurs: boolean }
): Promise<{ viewer: Viewer; campaignId: string | null } | null> {
  const campaignId = await resolveCampaignId(supabase, params.worldId);
  if (!params.vueJoueurs) {
    return { viewer: await buildViewerForWorld(supabase, params.worldId, params.userId), campaignId };
  }
  if (!(await isWorldAdmin(supabase, { worldId: params.worldId, userId: params.userId }))) return null;
  return { viewer: genericPlayerViewer(campaignId), campaignId };
}
