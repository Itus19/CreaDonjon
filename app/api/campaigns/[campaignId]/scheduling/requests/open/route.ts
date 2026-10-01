import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOpenRequest, getRequestBoard, getTargetSessionMinutes } from "@/src/server/services/scheduling";

/** La ronde ouverte d'une campagne (V3.1-8), avec les dates possibles et la carte de chaleur — lue par le Calendrier réel du MJ ET par la page joueuse (V3.1-16 : la RLS de `real_session_availabilities` ouvre déjà ces réponses à tout membre du monde). `viewerId` sert à marquer « (toi) ». `request: null` si aucune ronde n'est ouverte. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const request = await getOpenRequest(supabase, campaignId);
  if (!request) {
    return NextResponse.json({ request: null, days: [], heatmap: null, expected: 0, viewerId: user.id, targetMinutes: await getTargetSessionMinutes(supabase, campaignId) }, { status: 200 });
  }

  const [board, targetMinutes] = await Promise.all([getRequestBoard(supabase, campaignId, request), getTargetSessionMinutes(supabase, campaignId)]);
  return NextResponse.json({ request, ...board, viewerId: user.id, targetMinutes }, { status: 200 });
}
