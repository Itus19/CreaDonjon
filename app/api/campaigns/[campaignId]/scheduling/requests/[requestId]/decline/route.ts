import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requestIdSchema } from "@/lib/scheduling/schemas";
import { declineRequest } from "@/src/server/services/scheduling";

/**
 * V3.1-190 — « Aucune date ne me va » : efface mes dates cochées pour cette
 * demande et note ma réponse. Cocher ensuite une date l'annule
 * (`respondToRequest`). Chacune n'écrit que sa propre ligne (RLS).
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ campaignId: string; requestId: string }> }) {
  const { campaignId, requestId } = await params;
  if (!requestIdSchema.safeParse(campaignId).success || !requestIdSchema.safeParse(requestId).success) {
    return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const ok = await declineRequest(supabase, { campaignId, requestId, userId: user.id });
  if (!ok) return NextResponse.json({ error: "Cette demande de disponibilités n'est plus ouverte." }, { status: 409 });
  return new NextResponse(null, { status: 204 });
}
