import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getEntityById } from "@/src/server/repos/entities";
import { getCurrentAttitude } from "@/src/server/services/psyche";

/**
 * Attitude courante de l'entite envers une cible (V2-H1, bloc `relationship`)
 * — resout la campagne toute seule. `getCurrentAttitude` prend desormais
 * `worldId` en parametre (audit de performance) : cette route est le seul
 * appelant qui ne l'a pas deja en main, donc le seul a devoir le lire ici —
 * jamais un lookup redondant, contrairement a l'ancien comportement ou
 * `getCurrentAttitude` refaisait ce meme lookup pour TOUT appelant, y
 * compris ceux qui avaient deja l'entite chargee.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; targetId: string }> }
) {
  const { id, targetId } = await params;
  const supabase = await createClient();
  const entity = await getEntityById(supabase, id);
  if (!entity) return NextResponse.json({ axes: {}, campaignId: null }, { status: 200 });
  const result = await getCurrentAttitude(supabase, entity.world_id, id, targetId);
  return NextResponse.json(result, { status: 200 });
}
