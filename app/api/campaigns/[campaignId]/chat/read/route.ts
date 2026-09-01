import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { markChatRead } from "@/src/server/repos/chatMessages";

/** Marque le salon lu maintenant (V2-M12, pastille) — appele a l'ouverture du panneau de chat, remet le compteur a zero cote client. */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  await markChatRead(supabase, { campaignId, userId: user.id });
  return NextResponse.json({ ok: true }, { status: 200 });
}
