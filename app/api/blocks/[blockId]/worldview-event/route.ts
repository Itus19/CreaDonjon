import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { addWorldviewEventSchema } from "@/lib/blocks/schemas";
import { addWorldviewEvent } from "@/src/server/services/psyche";

/** Ajoute un souvenir a un bloc `worldview` (V2-H1) — meme patron que `personality-event`. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ blockId: string }> }) {
  const { blockId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = addWorldviewEventSchema.safeParse(body);
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

  const result = await addWorldviewEvent(supabase, {
    blockId,
    expectedVersion: parsed.data.version,
    summary: parsed.data.summary,
    deltas: parsed.data.deltas,
    occurredAtIngame: parsed.data.occurredAtIngame,
    origin: "gm",
    confirmed: parsed.data.confirmed,
    actorUserId: user.id,
  });

  if (!result.ok) {
    if (result.reason === "not_found") {
      return NextResponse.json({ error: "Bloc introuvable." }, { status: 404 });
    }
    if (result.reason === "wrong_block_type") {
      return NextResponse.json({ error: "Ce bloc n'est pas une worldview." }, { status: 400 });
    }
    if (result.reason === "unknown_pole") {
      return NextResponse.json({ error: "Pôle inconnu." }, { status: 400 });
    }
    if (result.reason === "needs_confirmation") {
      return NextResponse.json(
        { error: "Un changement de cette ampleur exige une confirmation explicite.", needsConfirmation: true },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Ce bloc a ete modifie entre-temps. Rechargez avant de reessayer." },
      { status: 409 }
    );
  }

  return NextResponse.json({ block: result.block, event: result.event }, { status: 200 });
}
