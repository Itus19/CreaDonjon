import { NextResponse, type NextRequest } from "next/server";
import { guardCombatRoute } from "@/lib/combats/routeGuard";
import { rechargeParticipantSchema } from "@/lib/combats/schemas";
import { getCombatParticipantById } from "@/src/server/repos/combats";
import { rollParticipantRecharges } from "@/src/server/services/combats";

/**
 * V3.1-129 (reçu de V3.1-79) — « Recharge d6 » sur une capacité dépensée de
 * l'instance : le serveur lance le dé (règle absolue 8), lit le seuil dans le
 * modèle de la créature, écrit et journalise (annulable). MJ seulement.
 * Une capacité prête, ou inconnue du modèle, ne lance rien : `rolls` vide.
 */
type Params = { params: Promise<{ campaignId: string; combatId: string; participantId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const guard = await guardCombatRoute(params);
  if (!guard.ok) return guard.response;
  const { supabase, userId } = guard;

  const parsed = rechargeParticipantSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Corps invalide." }, { status: 400 });
  }

  const participant = await getCombatParticipantById(supabase, guard.params.participantId!);
  if (!participant || participant.combat_id !== guard.params.combatId) {
    return NextResponse.json({ error: "Participant introuvable." }, { status: 404 });
  }

  const rolls = await rollParticipantRecharges(supabase, {
    participant,
    campaignId: guard.params.campaignId,
    actorUserId: userId,
    keys: [parsed.data.key],
  });
  return NextResponse.json({ rolls }, { status: 200 });
}
