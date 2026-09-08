import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildViewerForWorld } from "@/src/server/services/visibility";
import { getEntityById } from "@/src/server/repos/entities";
import { getRelationsGraph } from "@/src/server/services/relationsGraph";
import { relationsGraphQuerySchema, searchParamsToObject } from "@/lib/queryParams/schemas";

/**
 * Graphe de relations derive (V2-H1 phase 5) — meme patron que
 * `/genealogy` : les donnees stockees du bloc (`rootEntityId`/
 * `degreesVisible`) restent dans `EntityBlocks`, cette route ne renvoie
 * que ce qui exige le serveur, le graphe filtre par visibilite.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: entityId } = await params;
  const parsedQuery = relationsGraphQuerySchema.safeParse(searchParamsToObject(request.nextUrl.searchParams));
  if (!parsedQuery.success) {
    return NextResponse.json({ error: parsedQuery.error.issues[0]?.message ?? "Parametres invalides." }, { status: 400 });
  }
  const { maxDegree } = parsedQuery.data;
  const rootEntityId = parsedQuery.data.rootEntityId ?? entityId;

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
  const graph = await getRelationsGraph(supabase, {
    worldId: entity.world_id,
    rootEntityId,
    maxDegree,
    viewer,
  });

  return NextResponse.json(graph, { status: 200 });
}
