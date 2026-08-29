import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { addAttitudeEventSchema } from "@/lib/blocks/schemas";
import { addAttitudeEvent } from "@/src/server/services/psyche";

/**
 * Ajoute un souvenir a une relation (V2-H1) — journalise ET met a jour le
 * cache `entity_attitudes`, meme route pour un curseur deplace a la main
 * et pour un vrai souvenir raconte (meme motif que `personality-event`).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = addAttitudeEventSchema.safeParse(body);
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

  const result = await addAttitudeEvent(supabase, {
    sourceEntityId: id,
    targetEntityId: parsed.data.targetEntityId,
    summary: parsed.data.summary,
    deltas: parsed.data.deltas,
    occurredAtIngame: parsed.data.occurredAtIngame,
    origin: "gm",
    confirmed: parsed.data.confirmed,
  });

  if (!result.ok) {
    if (result.reason === "no_campaign") {
      return NextResponse.json({ error: "Ce monde n'a pas de campagne active." }, { status: 400 });
    }
    if (result.reason === "unknown_axis") {
      return NextResponse.json({ error: "Axe inconnu." }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Un changement de cette ampleur exige une confirmation explicite.", needsConfirmation: true },
      { status: 409 }
    );
  }

  return NextResponse.json({ axes: result.axes, event: result.event }, { status: 200 });
}
