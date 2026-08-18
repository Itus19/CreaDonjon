import { NextResponse, type NextRequest } from "next/server";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getCombatParticipantById } from "@/src/server/repos/combats";
import { getParticipantCharacteristics } from "@/src/server/services/combats";
import type { Locale } from "@/src/i18n/request";

/** Caracteristiques completes d'un participant (V1-E4 suite) — derouleur "Caracteristiques" de l'ecran Initiative : bloc de monstre complet ou reference vers la fiche de personnage. */
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
  const characteristics = await getParticipantCharacteristics(supabase, { participant, campaignId, locale });
  return NextResponse.json(characteristics, { status: 200 });
}
