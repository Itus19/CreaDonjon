import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCampaign, getCampaignCharacters, getCampaignMembers, getCampaignRulesetOrigin } from "@/src/server/services/campaigns";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  const supabase = await createClient();

  const campaign = await getCampaign(supabase, campaignId);
  if (!campaign) {
    return NextResponse.json({ error: "Campagne introuvable." }, { status: 404 });
  }

  const [members, characters, rulesetContentOrigin] = await Promise.all([
    getCampaignMembers(supabase, campaignId),
    getCampaignCharacters(supabase, campaignId),
    getCampaignRulesetOrigin(supabase, campaignId),
  ]);

  return NextResponse.json({ campaign, members, characters, rulesetContentOrigin }, { status: 200 });
}
