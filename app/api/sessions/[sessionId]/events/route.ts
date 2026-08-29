import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionEvents } from "@/src/server/services/sessions";

/** Fil d'une session, du plus ancien au plus recent — lecture seule pour le bloc `session_log` (V2-H4). */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const supabase = await createClient();
  const events = await getSessionEvents(supabase, sessionId);
  return NextResponse.json(events, { status: 200 });
}
