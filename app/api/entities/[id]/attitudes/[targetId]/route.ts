import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAttitude } from "@/src/server/services/psyche";

/** Attitude courante de l'entite envers une cible (V2-H1, bloc `relationship`) — resout la campagne toute seule. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; targetId: string }> }
) {
  const { id, targetId } = await params;
  const supabase = await createClient();
  const result = await getCurrentAttitude(supabase, id, targetId);
  return NextResponse.json(result, { status: 200 });
}
