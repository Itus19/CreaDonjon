import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getEntityById } from "@/src/server/repos/entities";
import { getCurrentAttitude } from "@/src/server/services/psyche";
import { canReadRelationship } from "@/src/server/services/relationshipFace";

const zParams = z.object({ id: z.string().uuid(), targetId: z.string().uuid() });

/**
 * Attitude courante de l'entite envers une cible (V2-H1, bloc `relationship`)
 * — resout la campagne toute seule. `getCurrentAttitude` prend desormais
 * `worldId` en parametre (audit de performance) : cette route est le seul
 * appelant qui ne l'a pas deja en main, donc le seul a devoir le lire ici —
 * jamais un lookup redondant, contrairement a l'ancien comportement ou
 * `getCurrentAttitude` refaisait ce meme lookup pour TOUT appelant, y
 * compris ceux qui avaient deja l'entite chargee.
 *
 * V3.1-71 : la RLS ne connaît que l'appartenance au monde ; un joueur ne lit
 * plus une relation dont aucun bloc ne lui est visible (`canReadRelationship`).
 * Refus : la même réponse qu'une relation vide, rien ne trahit qu'elle existe.
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
  if (!entity) return NextResponse.json({ axes: {}, campaignId: null }, { status: 200 });
  if (!(await canReadRelationship(supabase, { sourceEntityId: id, targetEntityId: targetId, userId: user.id }))) {
    return NextResponse.json({ axes: {}, campaignId: null }, { status: 200 });
  }
  const result = await getCurrentAttitude(supabase, entity.world_id, id, targetId);
  return NextResponse.json(result, { status: 200 });
}
