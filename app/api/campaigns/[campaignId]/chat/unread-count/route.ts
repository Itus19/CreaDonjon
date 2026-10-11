import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCampaignById } from "@/src/server/repos/campaigns";
import { countUnreadChatMessages } from "@/src/server/services/chat";

/**
 * Compte initial pour la pastille (V2-M13) — un joueur : son seul fil. Le
 * MJ : somme de tous les fils (badge global de la barre laterale ; le
 * detail par joueur vit dans `GET .../chat/threads`). Au chargement de la
 * page seulement, les arrivees suivantes sont comptees en direct par
 * Realtime cote client (`useChatUnread`).
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;

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

  const count = await countUnreadChatMessages(supabase, { campaignId, worldId: campaign.world_id, userId: user.id });
  return NextResponse.json({ count }, { status: 200 });
}
