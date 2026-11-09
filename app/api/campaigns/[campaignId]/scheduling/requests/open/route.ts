import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requestIdSchema } from "@/lib/scheduling/schemas";
import { getSchedulingBoard } from "@/src/server/services/scheduling";

/**
 * V3.1-190 — tout l'écran du calendrier réel en une réponse : les cartes des
 * demandes ouvertes, puis, pour la demande affichée (`?requestId=`, sinon la
 * plus ancienne), la grille, les dates possibles, qui a répondu et mes
 * propres réponses. Lue à l'identique par le MJ et la joueuse ; la RLS borne
 * ce que chacun lit (membre du monde).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  const campaign = requestIdSchema.safeParse(campaignId);
  const raw = request.nextUrl.searchParams.get("requestId");
  const requestId = raw === null ? null : requestIdSchema.safeParse(raw);
  if (!campaign.success || (requestId !== null && !requestId.success)) {
    return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const board = await getSchedulingBoard(supabase, { campaignId, userId: user.id, requestId: requestId?.data ?? null });
  return NextResponse.json(board, { status: 200 });
}
