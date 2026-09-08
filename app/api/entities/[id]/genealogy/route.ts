import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getEntityById } from "@/src/server/repos/entities";
import { buildViewerForWorld } from "@/src/server/services/visibility";
import { getFamilyTree } from "@/src/server/services/genealogy";
import { genealogyQuerySchema, searchParamsToObject } from "@/lib/queryParams/schemas";

/**
 * Arbre genealogique derive (V2-H3) — meme patron que `/sheet` : les
 * donnees stockees du bloc (`rootEntityId`/`depthUp`/`depthDown`) restent
 * dans `EntityBlocks`, cette route ne renvoie que ce qui exige le serveur,
 * ici le graphe filtre par visibilite (specs/wiki-blocs.md §2).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: entityId } = await params;
  const parsedQuery = genealogyQuerySchema.safeParse(searchParamsToObject(request.nextUrl.searchParams));
  if (!parsedQuery.success) {
    return NextResponse.json({ error: parsedQuery.error.issues[0]?.message ?? "Parametres invalides." }, { status: 400 });
  }
  const { depthUp, depthDown } = parsedQuery.data;
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
  const tree = await getFamilyTree(supabase, {
    worldId: entity.world_id,
    rootEntityId,
    depthUp,
    depthDown,
    viewer,
  });

  return NextResponse.json(tree, { status: 200 });
}
