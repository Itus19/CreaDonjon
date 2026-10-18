import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { resolveCampaignId } from "@/src/server/services/campaigns";
import {
  getMyResponsesForRequest,
  getOpenRequest,
  getPastSessions,
  getRequestBoard,
  getTargetSessionMinutes,
  getUpcomingSessions,
  hasRespondedToRequest,
} from "@/src/server/services/scheduling";

type TypedClient = SupabaseClient<Database>;

/**
 * V3.1-62, étape 3 (docs/CABLAGE.md, C1 et C3) — la page « Prochaine
 * session » de la joueuse, lue avec elle. Le panneau demandait après
 * l'affichage, en cascade, trois routes : `scheduling/open-request` (la
 * campagne et la demande ouverte), puis `requests/open` (le tableau) et
 * `sessions`. Mêmes fonctions, même client de l'appelant (RLS), même forme
 * de réponse que ces routes ; tout ce qui ne dépend que de la campagne part
 * en une vague.
 */
export async function chargerProchaineSession(supabase: TypedClient, params: { worldId: string; userId: string }) {
  const campaignId = await resolveCampaignId(supabase, params.worldId);
  if (!campaignId) return null;

  const [request, targetMinutes, upcoming, past] = await Promise.all([
    getOpenRequest(supabase, campaignId),
    getTargetSessionMinutes(supabase, campaignId),
    getUpcomingSessions(supabase, campaignId),
    getPastSessions(supabase, campaignId),
  ]);

  if (!request) {
    return {
      openData: { campaignId, request: null, hasResponded: false, myResponses: [] },
      board: { request: null, days: [], heatmap: null, expected: 0, viewerId: params.userId, targetMinutes },
      upcoming,
      past,
    };
  }

  const [hasResponded, myResponses, board] = await Promise.all([
    hasRespondedToRequest(supabase, request.id, params.userId),
    getMyResponsesForRequest(supabase, request.id, params.userId),
    getRequestBoard(supabase, campaignId, request),
  ]);
  return {
    openData: { campaignId, request, hasResponded, myResponses },
    board: { request, ...board, viewerId: params.userId, targetMinutes },
    upcoming,
    past,
  };
}
