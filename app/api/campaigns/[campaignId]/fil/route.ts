import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrOpenSessionForCampaign } from "@/src/server/services/sessions";
import { buildFilForSession } from "@/src/server/services/turnFil";
import { getSceneState } from "@/src/server/repos/sceneStates";

/**
 * V3-D4 — Le fil de la session OUVERTE de cette campagne, tel qu'il vit
 * réellement en base. Même repli lecture-seule que `.../dice-rolls` (RLS
 * `session_events_select` filtre déjà ce que cet appelant a le droit de
 * voir, aucun second contrôle ici) : cette route ne fait qu'ouvrir/retrouver
 * la session puis relire son fil, rien d'écrit.
 *
 * V3.2-27 : l'heure de la scène ferme la ligne du dernier tour (une ligne de
 * `scene_states` de plus par lecture ; le sondage des conséquences, lui, ne
 * tourne plus que quand leur onglet est ouvert : le compte baisse).
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  const supabase = await createClient();
  const [sessionId, scene] = await Promise.all([getOrOpenSessionForCampaign(supabase, campaignId), getSceneState(supabase, campaignId)]);
  const items = await buildFilForSession(supabase, sessionId, scene?.time ?? null);
  return NextResponse.json({ items }, { status: 200 });
}
