import { NextResponse, type NextRequest } from "next/server";
import { getLocale } from "next-intl/server";
import { guardCombatRoute } from "@/lib/combats/routeGuard";
import { rollInitiativeSchema } from "@/lib/combats/schemas";
import { checkCombatAccess, rollAllInitiatives, rollParticipantInitiative } from "@/src/server/services/combats";
import { serverRng } from "@/src/server/services/rng";
import type { Locale } from "@/src/i18n/request";

/** "Lancer toutes les initiatives" (sans `participantId`) ou une seule relance (specs/outils-mj.md §5.4) — un seul appel serveur, `serverRng` (jamais Math.random()). MJ seulement (V3.1-101). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ campaignId: string; combatId: string }> }) {
  const guard = await guardCombatRoute(params);
  if (!guard.ok) return guard.response;
  const { supabase, userId } = guard;
  const { campaignId } = guard.params;
  const combatId = guard.params.combatId!;

  const body = await request.json().catch(() => ({}));
  const parsed = rollInitiativeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Corps invalide." }, { status: 400 });
  }

  const locale = (await getLocale()) as Locale;

  if (parsed.data.participantId) {
    // Le participant vient du corps, pas de l'adresse : meme verification d'appartenance au combat.
    const access = await checkCombatAccess(supabase, { userId, campaignId, combatId, participantId: parsed.data.participantId });
    if (access !== "ok") {
      return NextResponse.json({ error: "Participant introuvable." }, { status: 404 });
    }
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
