import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrOpenSessionForCampaign } from "@/src/server/services/sessions";
import { buildConsequencesDrawer } from "@/src/server/services/consequencesDrawer";

/**
 * V3-C5 — Le tiroir de conséquences de la session OUVERTE de cette campagne.
 * Même repli lecture-seule que `.../fil` (V3-D4) : la RLS de `ai_proposals`
 * filtre déjà ce que cet appelant a le droit de voir, aucun second contrôle
 * ici.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  const supabase = await createClient();
  const sessionId = await getOrOpenSessionForCampaign(supabase, campaignId);
  const drawer = await buildConsequencesDrawer(supabase, { campaignId, sessionId });
  return NextResponse.json(drawer, { status: 200 });
}
