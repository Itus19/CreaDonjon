import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPersonalityEvents } from "@/src/server/services/psyche";

/** Les 20 derniers souvenirs d'un bloc `personality` (V2-H1), pour le tableau sous le radar. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: entityId } = await params;
  const supabase = await createClient();
  const events = await getPersonalityEvents(supabase, entityId);
  return NextResponse.json(events, { status: 200 });
}
