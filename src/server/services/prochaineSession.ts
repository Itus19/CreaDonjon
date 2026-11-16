import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { resolveCampaignId } from "@/src/server/services/campaigns";
import { getPastSessions, getSchedulingBoard, getUpcomingSessions } from "@/src/server/services/scheduling";

type TypedClient = SupabaseClient<Database>;

/**
 * V3.1-62, étape 3 (docs/CABLAGE.md, C1 et C3) — la page « Prochaine
 * session » de la joueuse, lue avec elle. V3.1-190 : le tableau de l'écran
 * (`getSchedulingBoard`, toutes les demandes ouvertes et celle affichée) et
 * les séances partent en une vague, avec le même client (RLS) et la même
 * forme que la route `requests/open`.
 */
export async function chargerProchaineSession(supabase: TypedClient, params: { worldId: string; userId: string }) {
  const campaignId = await resolveCampaignId(supabase, params.worldId);
  if (!campaignId) return null;

  const [board, upcoming, past] = await Promise.all([
    getSchedulingBoard(supabase, { campaignId, userId: params.userId, requestId: null }),
    getUpcomingSessions(supabase, campaignId),
    getPastSessions(supabase, campaignId),
  ]);
  return { campaignId, board, upcoming, past };
}
