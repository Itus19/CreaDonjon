import { NextResponse, type NextRequest } from "next/server";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getCombatParticipantById } from "@/src/server/repos/combats";
import { getParticipantActionsSummary } from "@/src/server/services/combats";
import type { Locale } from "@/src/i18n/request";

/** Actions/traits possibles d'un participant (V1-E4) — panneau deroulant de l'ecran Initiative, pour eviter les allers-retours vers les fiches. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ campaignId: string; participantId: string }> }
) {
  const { campaignId, participantId } = await params;
  const supabase = await createClient();
  const participant = await getCombatParticipantById(supabase, participantId);
  if (!participant) {
    return NextResponse.json({ error: "Participant introuvable." }, { status: 404 });
  }
  const locale = (await getLocale()) as Locale;
  const summary = await getParticipantActionsSummary(supabase, { participant, campaignId, locale });
  return NextResponse.json(summary, { status: 200 });
}
