import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCampaignById } from "@/src/server/repos/campaigns";
import { getCampaignEconomyStats } from "@/src/server/services/campaignEconomy";

/** Stats d'economie de campagne (V2-M12, ecran d'accueil joueur) — argent gagne/depense, agrege sur toute l'histoire des PJ de la campagne. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;

  const supabase = await createClient();
  const campaign = await getCampaignById(supabase, campaignId);
  if (!campaign) {
    return NextResponse.json({ error: "Campagne introuvable." }, { status: 404 });
  }

  const stats = await getCampaignEconomyStats(supabase, { worldId: campaign.world_id });
  return NextResponse.json(stats, { status: 200 });
}
