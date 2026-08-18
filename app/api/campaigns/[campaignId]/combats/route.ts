import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCampaign } from "@/src/server/services/campaigns";
import { createCombatSchema } from "@/lib/combats/schemas";
import { createCombatFromMonsters, listCombatsForCampaign } from "@/src/server/services/combats";

/** "Mes combats" (V1-E4) — les combats d'une campagne, plus recents d'abord. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  const supabase = await createClient();
  const combats = await listCombatsForCampaign(supabase, campaignId);
  return NextResponse.json({ combats }, { status: 200 });
}

/** "Lancer le combat" (V1-E4, depuis la composition de Rencontres, V1-E3). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = createCombatSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Corps invalide." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const campaign = await getCampaign(supabase, campaignId);
  if (!campaign) {
    return NextResponse.json({ error: "Campagne introuvable." }, { status: 404 });
  }

  const combat = await createCombatFromMonsters(supabase, {
    campaignId,
    rulesetId: campaign.rulesetId,
    name: parsed.data.name,
    monsters: parsed.data.monsters,
  });
  return NextResponse.json(combat, { status: 201 });
}
