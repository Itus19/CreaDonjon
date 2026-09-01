import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getEntityById } from "@/src/server/repos/entities";
import { getBlockById } from "@/src/server/repos/blocks";
import { buildViewerForWorld } from "@/src/server/services/visibility";
import { resolveMapSource } from "@/src/server/services/mapSource";

/**
 * Resout un bloc `map` propriétaire en image affichable pour le viewer
 * authentifié courant (Lot I, phase F₁) — utilisé à la fois par le
 * sélecteur de carte (aperçu avant confirmation) et par le rendu d'un bloc
 * déjà en mode "ref" (`sourceBlockId` stocké, jamais l'image elle-même).
 * `blockId` ici est le bloc SOURCE (propriétaire), jamais le bloc référent
 * qui pointe vers lui.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ blockId: string }> }) {
  const { blockId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const block = await getBlockById(supabase, blockId);
  if (!block) {
    return NextResponse.json(null, { status: 200 });
  }
  const entity = await getEntityById(supabase, block.entity_id);
  if (!entity) {
    return NextResponse.json(null, { status: 200 });
  }

  const viewer = await buildViewerForWorld(supabase, entity.world_id, user.id);
  const source = await resolveMapSource(supabase, blockId, viewer);
  return NextResponse.json(source, { status: 200 });
}
