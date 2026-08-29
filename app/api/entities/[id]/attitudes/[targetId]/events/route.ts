import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAttitudeEvents } from "@/src/server/services/psyche";

/** Les 20 derniers souvenirs de cette paire (V2-H1), pour le tableau du bloc `relationship`. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; targetId: string }> }
) {
  const { id, targetId } = await params;
  const supabase = await createClient();
  const events = await getAttitudeEvents(supabase, id, targetId);
  return NextResponse.json(events, { status: 200 });
}
