import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildViewerForWorld } from "@/src/server/services/visibility";
import { getEntityById } from "@/src/server/repos/entities";
import { getRelationsGraphData } from "@/src/server/services/relationsGraph";

/**
 * Aretes + entites du monde, deja filtrees par visibilite, sans le
 * parcours en largeur (retour utilisateur : "changer le degre met du
 * temps a charger") — `RelationsGraphBlockEditor.tsx` ne l'appelle
 * qu'une fois par montage (jamais a chaque changement de degre) et
 * recalcule le graphe visible localement via `buildRelationsGraph`
 * (src/core, pur, sans reseau). Meme resolution d'acces que
 * `/relations-graph`, juste sans le `maxDegree`.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: entityId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const entity = await getEntityById(supabase, entityId);
  if (!entity) {
    return NextResponse.json({ error: "Entite introuvable." }, { status: 404 });
  }

  const viewer = await buildViewerForWorld(supabase, entity.world_id, user.id);
  const data = await getRelationsGraphData(supabase, { worldId: entity.world_id, viewer });

  return NextResponse.json(data, { status: 200 });
}
