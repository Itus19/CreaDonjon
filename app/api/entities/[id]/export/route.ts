import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listVisibleBlocks } from "@/src/server/services/blocks";
import { getEntityById } from "@/src/server/repos/entities";
import { getEntityRuntimeState } from "@/src/server/services/runtimeState";

const EXPORTED_BLOCK_TYPES = new Set(["character", "inventory", "spellcasting", "resources"]);

/**
 * Export JSON de la fiche jouable (V1-B5, specs/fiche-personnage-interactive.md
 * §6) : le build (blocs, deja filtres par visibilite comme partout
 * ailleurs) et l'etat de jeu — jamais une valeur derivee de
 * `characterSheet()`. Reimporter recalcule tout, et suit les regles si
 * elles ont change entre-temps.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: entityId } = await params;
  const campaignId = request.nextUrl.searchParams.get("campaignId");

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

  const [blocks, runtimeState] = await Promise.all([
    listVisibleBlocks(supabase, entity.world_id, entityId, user.id),
    getEntityRuntimeState(supabase, entityId, campaignId),
  ]);

  const exportedBlocks: Record<string, unknown> = {};
  for (const block of blocks) {
    if (EXPORTED_BLOCK_TYPES.has(block.blockType)) exportedBlocks[block.blockType] = block.data;
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    entityName: entity.name,
    blocks: exportedBlocks,
    runtimeState,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${entity.slug}.json"`,
    },
  });
}
