import { NextResponse, type NextRequest } from "next/server";
import { getLocale } from "next-intl/server";
import { guardCombatRoute } from "@/lib/combats/routeGuard";
import { getCombatParticipantById } from "@/src/server/repos/combats";
import { getParticipantCharacteristics } from "@/src/server/services/combats";
import type { Locale } from "@/src/i18n/request";

/** Caracteristiques completes d'un participant (V1-E4 suite) — derouleur "Caracteristiques" de l'ecran Initiative : bloc de monstre complet ou reference vers la fiche de personnage. MJ seulement (V3.1-101) : la CA et les PV adverses n'arrivent jamais a un joueur. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ campaignId: string; combatId: string; participantId: string }> }
) {
  const guard = await guardCombatRoute(params);
  if (!guard.ok) return guard.response;
  const { supabase } = guard;
  const { campaignId } = guard.params;
  const participant = await getCombatParticipantById(supabase, guard.params.participantId!);
  if (!participant) {
    return NextResponse.json({ error: "Participant introuvable." }, { status: 404 });
  }
  const locale = (await getLocale()) as Locale;
  const characteristics = await getParticipantCharacteristics(supabase, { participant, campaignId, locale });
  return NextResponse.json(characteristics, { status: 200 });
}
