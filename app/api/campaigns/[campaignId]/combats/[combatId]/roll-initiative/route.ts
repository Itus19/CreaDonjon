import { NextResponse, type NextRequest } from "next/server";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { rollInitiativeSchema } from "@/lib/combats/schemas";
import { rollAllInitiatives, rollParticipantInitiative } from "@/src/server/services/combats";
import { serverRng } from "@/src/server/services/rng";
import type { Locale } from "@/src/i18n/request";

/** "Lancer toutes les initiatives" (sans `participantId`) ou une seule relance (specs/outils-mj.md §5.4) — un seul appel serveur, `serverRng` (jamais Math.random()). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ campaignId: string; combatId: string }> }) {
  const { campaignId, combatId } = await params;

  const body = await request.json().catch(() => ({}));
  const parsed = rollInitiativeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Corps invalide." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const locale = (await getLocale()) as Locale;

  if (parsed.data.participantId) {
    const participant = await rollParticipantInitiative(supabase, {
      participantId: parsed.data.participantId,
      campaignId,
      locale,
      rng: serverRng,
    });
    if (!participant) {
      return NextResponse.json({ error: "Participant introuvable." }, { status: 404 });
    }
    return NextResponse.json({ participants: [participant] }, { status: 200 });
  }

  const participants = await rollAllInitiatives(supabase, { combatId, campaignId, locale, rng: serverRng });
  return NextResponse.json({ participants }, { status: 200 });
}
