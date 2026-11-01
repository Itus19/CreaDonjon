import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { freeformRollSchema } from "@/lib/diceRolls/schemas";
import { getClaimedCharacterName, rollFreeformCheck } from "@/src/server/services/checkRolls";
import { isWorldAdmin } from "@/src/server/services/permissions";
import { getCampaignById } from "@/src/server/repos/campaigns";
import { listDiceRollsForCampaign } from "@/src/server/repos/diceRolls";
import { diceRollsQuerySchema, searchParamsToObject } from "@/lib/queryParams/schemas";
import { rollDetailForReader } from "@/src/core/dice/rollForReader";

/** Onglet Historique du volet (V2-M11) — RLS `dice_rolls_select` filtre deja les jets secrets d'un simple joueur ; le verdict d'un DD prive est retire ici (V3.1-22). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  const parsedQuery = diceRollsQuerySchema.safeParse(searchParamsToObject(request.nextUrl.searchParams));
  if (!parsedQuery.success) {
    return NextResponse.json({ error: parsedQuery.error.issues[0]?.message ?? "Parametres invalides." }, { status: 400 });
  }
  const { limit } = parsedQuery.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }
  const campaign = await getCampaignById(supabase, campaignId);
  if (!campaign) {
    return NextResponse.json({ error: "Campagne introuvable." }, { status: 404 });
  }
  const [rolls, isGm] = await Promise.all([
    listDiceRollsForCampaign(supabase, { campaignId, limit }),
    isWorldAdmin(supabase, { worldId: campaign.world_id, userId: user.id }),
  ]);
  // V3.1-22 (règle 5) : un verdict contre un DD privé ne part pas chez un joueur.
  return NextResponse.json({ rolls: rolls.map((r) => ({ ...r, detail: rollDetailForReader(r.detail, { isGm }) })) }, { status: 200 });
}

/** Jet de l'outil de des (V2-M11, V3.1-33) — aucune fiche, attribue au PJ revendique par l'appelant ou "MJ" (checkRolls.ts). Le client decrit le jet ; le serveur le lance. */
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
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
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
    modifier: parsed.data.modifier,
    advantage: parsed.data.advantage,
    label: parsed.data.label,
    dc: parsed.data.dc,
    dcPrivate: parsed.data.dcPrivate,
  });

  if (!result.ok) {
    const message = result.reason === "invalid_pool" ? "Choisissez au moins un dé." : "L'avantage demande un seul d20.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
  return NextResponse.json(result.roll, { status: 200 });
}
