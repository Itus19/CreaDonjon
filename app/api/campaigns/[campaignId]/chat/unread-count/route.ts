import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCampaignById } from "@/src/server/repos/campaigns";
import { countUnreadInThread, getChatLastReadAt } from "@/src/server/repos/chatMessages";
import { isWorldAdmin } from "@/src/server/services/permissions";
import { listChatThreadSummaries } from "@/src/server/services/chat";

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
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const campaign = await getCampaignById(supabase, campaignId);
  if (!campaign) {
    return NextResponse.json({ error: "Campagne introuvable." }, { status: 404 });
  }

  const isMj = await isWorldAdmin(supabase, { worldId: campaign.world_id, userId: user.id });
  if (isMj) {
    const threads = await listChatThreadSummaries(supabase, { campaignId, mjUserId: user.id });
    const count = threads.reduce((sum, t) => sum + t.unreadCount, 0);
    return NextResponse.json({ count }, { status: 200 });
  }

  const lastReadAt = await getChatLastReadAt(supabase, { campaignId, userId: user.id, threadUserId: user.id });
  const count = await countUnreadInThread(supabase, { campaignId, threadUserId: user.id, readerId: user.id, sinceExclusive: lastReadAt });
  return NextResponse.json({ count }, { status: 200 });
}
