import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCampaignById } from "@/src/server/repos/campaigns";
import { isWorldAdmin } from "@/src/server/services/permissions";
import { listChatThreadSummaries } from "@/src/server/services/chat";

/** Selecteur de fils du MJ (V2-M13, "une fenetre de chat par joueur") — reserve au MJ reel de ce monde, jamais un joueur (qui n'a qu'un seul fil, le sien, pas de selecteur a lui presenter). */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;

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

  const isMj = await isWorldAdmin(supabase, { worldId: campaign.world_id, userId: user.id });
  if (!isMj) {
    return NextResponse.json({ error: "Réservé au MJ de ce monde." }, { status: 403 });
  }

  const threads = await listChatThreadSummaries(supabase, { campaignId, mjUserId: user.id });
  return NextResponse.json({ threads }, { status: 200 });
}
