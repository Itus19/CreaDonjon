import { NextResponse, type NextRequest } from "next/server";
import { getLocale } from "next-intl/server";
import { getCombatById } from "@/src/server/repos/combats";
import { recomputeMasking } from "@/src/server/services/combatPerception";
import type { Locale } from "@/src/i18n/request";
import { guardCombatRoute } from "@/lib/combats/routeGuard";
import { patchParticipantSchema } from "@/lib/combats/schemas";
import { patchCombatParticipant, removeParticipant } from "@/src/server/services/combats";

/** PV/PV-temp/conditions/concentration d'un participant (V1-E4) — pour un PJ, synchronise aussi entity_runtime_state (la fiche jouable lit la meme ligne). MJ seulement (V3.1-101). */
type Params = { params: Promise<{ campaignId: string; combatId: string; participantId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const guard = await guardCombatRoute(params);
  if (!guard.ok) return guard.response;
  const { supabase, userId } = guard;
  const participantId = guard.params.participantId!;

  const body = await request.json().catch(() => null);
  const parsed = patchParticipantSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Corps invalide." }, { status: 400 });
  }

  const participant = await patchCombatParticipant(supabase, {
    participantId,
    patch: {
      label: parsed.data.label,
      initiative: parsed.data.initiative,
      ac: parsed.data.ac,
      hpCurrent: parsed.data.hpCurrent,
      tempHp: parsed.data.tempHp,
      conditions: parsed.data.conditions,
      concentration: parsed.data.concentration,
      resourcesUsed: parsed.data.resourcesUsed,
    },
    actorUserId: userId,
    note: parsed.data.note,
  });
  if (!participant) {
    return NextResponse.json({ error: "Participant introuvable." }, { status: 404 });
  }
  // V3.1-181 (ADR 0078) : un état qui touche la vue (Invisible, Caché, Aveuglé) change ce que les joueuses voient.
  if (parsed.data.conditions !== undefined) {
    const combat = await getCombatById(supabase, participant.combat_id);
    if (combat) await recomputeMasking(supabase, { campaignId: guard.params.campaignId, combat, callerIsGm: true, locale: (await getLocale()) as Locale });
  }
  return NextResponse.json(participant, { status: 200 });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const guard = await guardCombatRoute(params);
  if (!guard.ok) return guard.response;

  await removeParticipant(guard.supabase, guard.params.participantId!);
  return NextResponse.json({ ok: true }, { status: 200 });
}
