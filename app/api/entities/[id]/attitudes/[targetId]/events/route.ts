import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getEntityById } from "@/src/server/repos/entities";
import { getAttitudeEvents } from "@/src/server/services/psyche";
import { canReadRelationship } from "@/src/server/services/relationshipFace";

const zParams = z.object({ id: z.string().uuid(), targetId: z.string().uuid() });

/**
 * Les 20 derniers souvenirs de cette paire (V2-H1), pour le tableau du bloc
 * `relationship`. `getAttitudeEvents` prend desormais `worldId` en
 * parametre (audit de performance, meme raison que la route `attitudes/[targetId]`
 * juste a cote) — seul appelant sans l'entite deja en main, seul a faire ce lookup.
 *
 * V3.1-71 : même garde de lecture que la route voisine (`canReadRelationship`).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; targetId: string }> }
) {
  const parsed = zParams.safeParse(await params);
  if (!parsed.success) return NextResponse.json({ error: "Adresse invalide." }, { status: 400 });
  const { id, targetId } = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  const entity = await getEntityById(supabase, id);
  if (!entity) return NextResponse.json([], { status: 200 });
  if (!(await canReadRelationship(supabase, { sourceEntityId: id, targetEntityId: targetId, userId: user.id }))) {
    return NextResponse.json([], { status: 200 });
  }
  const events = await getAttitudeEvents(supabase, entity.world_id, id, targetId);
  return NextResponse.json(events, { status: 200 });
}
