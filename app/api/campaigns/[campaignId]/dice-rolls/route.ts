import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { freeformRollSchema } from "@/lib/diceRolls/schemas";
import { getClaimedCharacterName, rollFreeformCheck } from "@/src/server/services/checkRolls";
import { isWorldAdmin } from "@/src/server/services/permissions";
import { getCampaignById } from "@/src/server/repos/campaigns";
import { listDiceRollsForCampaign } from "@/src/server/repos/diceRolls";

const HISTORY_LIMIT_DEFAULT = 50;
const HISTORY_LIMIT_MAX = 200;

/** Onglet Historique du volet (V2-M11) — RLS `dice_rolls_select` filtre deja les jets `gm` pour un simple joueur, jamais un second filtre ici. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  const requested = Number(request.nextUrl.searchParams.get("limit") ?? HISTORY_LIMIT_DEFAULT);
  const limit = Number.isFinite(requested) ? Math.min(Math.max(Math.trunc(requested), 1), HISTORY_LIMIT_MAX) : HISTORY_LIMIT_DEFAULT;

  const supabase = await createClient();
  const rolls = await listDiceRollsForCampaign(supabase, { campaignId, limit });
  return NextResponse.json({ rolls }, { status: 200 });
}

/** Jet libre depuis la reserve du volet (V2-M11) — aucune fiche, attribue au PJ revendique par l'appelant ou "MJ" (checkRolls.ts). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = freeformRollSchema.safeParse(body);
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

  const campaign = await getCampaignById(supabase, campaignId);
  if (!campaign) {
    return NextResponse.json({ error: "Campagne introuvable." }, { status: 404 });
  }
  const [claimedName, isAdmin] = await Promise.all([
    getClaimedCharacterName(supabase, { campaignId, userId: user.id }),
    isWorldAdmin(supabase, { worldId: campaign.world_id, userId: user.id }),
  ]);
  const who = claimedName ?? (isAdmin ? "MJ" : "Joueur");

  const result = await rollFreeformCheck(supabase, {
    campaignId,
    callerId: user.id,
    pool: parsed.data.pool,
    who,
    hidden: parsed.data.hidden,
  });

  if (!result.ok) {
    return NextResponse.json({ error: "Choisissez au moins un de." }, { status: 400 });
  }
  return NextResponse.json(result.roll, { status: 200 });
}
