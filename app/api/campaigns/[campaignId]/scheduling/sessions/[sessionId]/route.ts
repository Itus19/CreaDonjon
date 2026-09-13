import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cancelRealSession } from "@/src/server/services/scheduling";

/** Annule une séance planifiée (réservé au MJ, RLS de `real_sessions`) — pour corriger une confirmation ou un réglage manuel erroné. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ campaignId: string; sessionId: string }> }) {
  const { sessionId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  await cancelRealSession(supabase, sessionId);
  return new NextResponse(null, { status: 204 });
}
