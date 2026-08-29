import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSessionSummary, setSessionSummary } from "@/src/server/services/sessions";

/** Session (dates, resume) pour le bloc `session_log` (V2-H4). */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const supabase = await createClient();
  const session = await getSessionSummary(supabase, sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session introuvable." }, { status: 404 });
  }
  return NextResponse.json(session, { status: 200 });
}

const patchSessionSchema = z.object({ summary: z.string().max(20000) });

/** Le resume glissant d'une session (docs/SCHEMA.md §12) — jamais un champ de bloc, une seule source de verite. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = patchSessionSchema.safeParse(body);
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

  const session = await setSessionSummary(supabase, sessionId, parsed.data.summary);
  return NextResponse.json(session, { status: 200 });
}
