import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrOpenSessionForCampaign } from "@/src/server/services/sessions";
import { buildFilForSession } from "@/src/server/services/turnFil";

/**
 * V3-D4 — Le fil de la session OUVERTE de cette campagne, tel qu'il vit
 * réellement en base. Même repli lecture-seule que `.../dice-rolls` (RLS
 * `session_events_select` filtre déjà ce que cet appelant a le droit de
 * voir, aucun second contrôle ici) : cette route ne fait qu'ouvrir/retrouver
 * la session puis relire son fil, rien d'écrit.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  const supabase = await createClient();
  const sessionId = await getOrOpenSessionForCampaign(supabase, campaignId);
  const items = await buildFilForSession(supabase, sessionId);
  return NextResponse.json({ items }, { status: 200 });
}
