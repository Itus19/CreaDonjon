import { NextResponse, type NextRequest } from "next/server";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getCampaign } from "@/src/server/services/campaigns";
import { getPartySkillProbabilities } from "@/src/server/services/partyProbabilities";
import type { Locale } from "@/src/i18n/request";

/**
 * Tableau MJ des probabilites de reussite (V1-E5, specs/arbitrage-modifications.md
 * §3.6) : DD fixes a 10/15/20 (§3.6, "colonnes DD 10 / 15 / 20") — pas de
 * parametre pour les personnaliser, un seul cas concret pour l'instant.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  const supabase = await createClient();

  const campaign = await getCampaign(supabase, campaignId);
  if (!campaign) {
    return NextResponse.json({ error: "Campagne introuvable." }, { status: 404 });
  }

  const locale = (await getLocale()) as Locale;
  const party = await getPartySkillProbabilities(supabase, campaignId, locale);

  return NextResponse.json({ party }, { status: 200 });
}
