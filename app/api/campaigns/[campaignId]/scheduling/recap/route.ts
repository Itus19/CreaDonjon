import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRankedDaysForMonth, getTargetSessionMinutes } from "@/src/server/services/scheduling";

/** Classement des jours d'un mois par disponibilité (V2.1-4, piste F) — `?year=2026&month=9`. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const year = Number(searchParams.get("year"));
  const month = Number(searchParams.get("month"));
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "Année/mois invalides." }, { status: 400 });
  }

  const [days, targetMinutes] = await Promise.all([
    getRankedDaysForMonth(supabase, campaignId, year, month),
    getTargetSessionMinutes(supabase, campaignId),
  ]);
  return NextResponse.json({ days, targetMinutes }, { status: 200 });
}
