import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCampaignById } from "@/src/server/repos/campaigns";
import { markChatRead } from "@/src/server/repos/chatMessages";
import { resolveThreadUserId } from "@/src/server/services/chat";
import { chatReadQuerySchema, searchParamsToObject } from "@/lib/queryParams/schemas";

/** Marque un fil lu maintenant (V2-M13, pastille) — appele a l'ouverture du panneau de chat, remet le compteur de CE fil a zero cote client. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;

  const parsedQuery = chatReadQuerySchema.safeParse(searchParamsToObject(request.nextUrl.searchParams));
  if (!parsedQuery.success) {
    return NextResponse.json({ error: parsedQuery.error.issues[0]?.message ?? "Parametres invalides." }, { status: 400 });
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

  const threadUserId = await resolveThreadUserId(supabase, {
    worldId: campaign.world_id,
    campaignId,
    callerId: user.id,
    requestedThreadUserId: parsedQuery.data.avec ?? null,
  });
  if (!threadUserId) {
    return NextResponse.json({ error: "Fil introuvable." }, { status: 404 });
  }

  await markChatRead(supabase, { campaignId, userId: user.id, threadUserId });
  return NextResponse.json({ ok: true }, { status: 200 });
}
