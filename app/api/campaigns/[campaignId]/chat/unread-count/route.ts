import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { countUnreadChatMessages, getChatLastReadAt } from "@/src/server/repos/chatMessages";

/** Compte initial pour la pastille (V2-M12) — au chargement de la page seulement, les arrivees suivantes sont comptees en direct par Realtime cote client (`useChatUnread`). */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const lastReadAt = await getChatLastReadAt(supabase, { campaignId, userId: user.id });
  const count = await countUnreadChatMessages(supabase, { campaignId, userId: user.id, sinceExclusive: lastReadAt });
  return NextResponse.json({ count }, { status: 200 });
}
