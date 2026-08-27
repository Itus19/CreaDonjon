import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getEntityById } from "@/src/server/repos/entities";
import { buildViewerForWorld } from "@/src/server/services/visibility";
import { getFamilyTree } from "@/src/server/services/genealogy";

/**
 * Arbre genealogique derive (V2-H3) — meme patron que `/sheet` : les
 * donnees stockees du bloc (`rootEntityId`/`depthUp`/`depthDown`) restent
 * dans `EntityBlocks`, cette route ne renvoie que ce qui exige le serveur,
 * ici le graphe filtre par visibilite (specs/wiki-blocs.md §2).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: entityId } = await params;
  const rootEntityId = request.nextUrl.searchParams.get("rootEntityId") || entityId;
  const depthUp = Number(request.nextUrl.searchParams.get("depthUp") ?? "2");
  const depthDown = Number(request.nextUrl.searchParams.get("depthDown") ?? "2");

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
    depthUp: Number.isFinite(depthUp) ? depthUp : 2,
    depthDown: Number.isFinite(depthDown) ? depthDown : 2,
    viewer,
  });

  return NextResponse.json(tree, { status: 200 });
}
