import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { attachSessionLogBlock } from "@/src/server/services/sessions";

const attachSchema = z.object({ version: z.number().int().positive() });

/**
 * Epingle un bloc `session_log` (V2-H4) sur la session de campagne en
 * cours — appele une seule fois par l'editeur quand `sessionId` est
 * encore `null` (`components/blocks/SessionLogBlockEditor.tsx`).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ blockId: string }> }) {
  const { blockId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = attachSchema.safeParse(body);
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

  const result = await attachSessionLogBlock(supabase, {
    blockId,
    expectedVersion: parsed.data.version,
    changedBy: user.id,
  });

  if (!result.ok) {
    if (result.reason === "not_found") {
      return NextResponse.json({ error: "Bloc introuvable." }, { status: 404 });
    }
    if (result.reason === "not_a_session_log") {
      return NextResponse.json({ error: "Ce bloc n'est pas un journal de séance." }, { status: 400 });
    }
    if (result.reason === "no_campaign") {
      return NextResponse.json({ error: "Ce monde n'a pas de campagne active." }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Ce bloc a ete modifie entre-temps. Rechargez avant de reessayer." },
      { status: 409 }
    );
  }

  return NextResponse.json({ block: result.block, session: result.session }, { status: 200 });
}
