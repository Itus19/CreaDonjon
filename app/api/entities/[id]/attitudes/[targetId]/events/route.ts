import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getEntityById } from "@/src/server/repos/entities";
import { getAttitudeEvents } from "@/src/server/services/psyche";

/**
 * Les 20 derniers souvenirs de cette paire (V2-H1), pour le tableau du bloc
 * `relationship`. `getAttitudeEvents` prend desormais `worldId` en
 * parametre (audit de performance, meme raison que la route `attitudes/[targetId]`
 * juste a cote) — seul appelant sans l'entite deja en main, seul a faire ce lookup.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; targetId: string }> }
) {
  const { id, targetId } = await params;
  const supabase = await createClient();
  const entity = await getEntityById(supabase, id);
  if (!entity) return NextResponse.json([], { status: 200 });
  const events = await getAttitudeEvents(supabase, entity.world_id, id, targetId);
  return NextResponse.json(events, { status: 200 });
}
