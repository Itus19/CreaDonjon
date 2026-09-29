import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getHeatmapForRequest, getOpenRequest, getRankedDaysForRequest, getTargetSessionMinutes } from "@/src/server/services/scheduling";

/** La ronde ouverte d'une campagne (V3.1-8), avec le classement des dates candidates et la carte de chaleur — panneau MJ (`SchedulingMjPanel.tsx`). `request: null` si aucune ronde n'est ouverte. */
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
    return NextResponse.json({ request: null, days: [], heatmap: null, targetMinutes: await getTargetSessionMinutes(supabase, campaignId) }, { status: 200 });
  }

  const [days, heatmap, targetMinutes] = await Promise.all([
    getRankedDaysForRequest(supabase, campaignId, request),
    getHeatmapForRequest(supabase, campaignId, request),
    getTargetSessionMinutes(supabase, campaignId),
  ]);
  return NextResponse.json({ request, days, heatmap, targetMinutes }, { status: 200 });
}
