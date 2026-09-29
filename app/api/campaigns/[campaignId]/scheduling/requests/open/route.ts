import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOpenRequest, getRankedDaysForRequest, getTargetSessionMinutes } from "@/src/server/services/scheduling";

/** La ronde ouverte d'une campagne (V3.1-8), avec le classement des dates candidates — panneau MJ (`SchedulingMjPanel.tsx`). `request: null` si aucune ronde n'est ouverte. */
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
    return NextResponse.json({ request: null, days: [], targetMinutes: await getTargetSessionMinutes(supabase, campaignId) }, { status: 200 });
  }

  const [days, targetMinutes] = await Promise.all([getRankedDaysForRequest(supabase, campaignId, request), getTargetSessionMinutes(supabase, campaignId)]);
  return NextResponse.json({ request, days, targetMinutes }, { status: 200 });
}
