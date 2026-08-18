import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { patchParticipantSchema } from "@/lib/combats/schemas";
import { patchCombatParticipant, removeParticipant } from "@/src/server/services/combats";

/** PV/PV-temp/conditions/concentration d'un participant (V1-E4) — pour un PJ, synchronise aussi entity_runtime_state (la fiche jouable lit la meme ligne). */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ participantId: string }> }) {
  const { participantId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = patchParticipantSchema.safeParse(body);
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

  const participant = await patchCombatParticipant(supabase, {
    participantId,
    patch: {
      initiative: parsed.data.initiative,
      hpCurrent: parsed.data.hpCurrent,
      tempHp: parsed.data.tempHp,
      conditions: parsed.data.conditions,
      concentration: parsed.data.concentration,
    },
    actorUserId: user.id,
    note: parsed.data.note,
  });
  if (!participant) {
    return NextResponse.json({ error: "Participant introuvable." }, { status: 404 });
  }
  return NextResponse.json(participant, { status: 200 });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ participantId: string }> }) {
  const { participantId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  await removeParticipant(supabase, participantId);
  return NextResponse.json({ ok: true }, { status: 200 });
}
