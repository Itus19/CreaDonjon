import { NextResponse, type NextRequest } from "next/server";
import { guardCombatRoute } from "@/lib/combats/routeGuard";
import { getCampaign } from "@/src/server/services/campaigns";
import { createCombatSchema } from "@/lib/combats/schemas";
import { createCombatFromMonsters, listCombatsForCampaign } from "@/src/server/services/combats";

/** "Mes combats" (V1-E4) — les combats d'une campagne, plus recents d'abord. MJ seulement (V3.1-101). */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  const guard = await guardCombatRoute(params);
  if (!guard.ok) return guard.response;
  const combats = await listCombatsForCampaign(guard.supabase, guard.params.campaignId);
  return NextResponse.json({ combats }, { status: 200 });
}

/** "Lancer le combat" (V1-E4, depuis la composition de Rencontres, V1-E3) — chaque generation cree un nouveau combat separe. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  const guard = await guardCombatRoute(params);
  if (!guard.ok) return guard.response;
  const { supabase } = guard;
  const { campaignId } = guard.params;

  const body = await request.json().catch(() => null);
  const parsed = createCombatSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Corps invalide." }, { status: 400 });
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
