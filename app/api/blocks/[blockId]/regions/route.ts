import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { zVueCarte } from "@/lib/mapPins/schemas";
import { resolveMapViewer } from "@/src/server/services/mapViewer";
import { createMapRegionSchema } from "@/lib/mapRegions/schemas";
import { getEntityById } from "@/src/server/repos/entities";
import { getBlockById } from "@/src/server/repos/blocks";
import { createMapRegion, listVisibleMapRegions } from "@/src/server/services/mapRegions";

/** Zones d'un bloc `map` propriétaire (Lot I, phase D) — `blockId` est toujours le bloc SOURCE (jamais un bloc "ref", voir ADR 0017). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ blockId: string }> }) {
  const { blockId } = await params;
  // V3.1-78 : « Voir comme les joueurs » (MJ seulement, `mapViewer.ts`).
  const vue = zVueCarte.safeParse({ vue: request.nextUrl.searchParams.get("vue") ?? undefined });
  if (!vue.success) return NextResponse.json({ error: "Vue invalide." }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const block = await getBlockById(supabase, blockId);
  if (!block) {
    return NextResponse.json([], { status: 200 });
  }
  const entity = await getEntityById(supabase, block.entity_id);
  if (!entity) {
    return NextResponse.json([], { status: 200 });
  }

  const lecteur = await resolveMapViewer(supabase, { worldId: entity.world_id, userId: user.id, vueJoueurs: vue.data.vue === "joueurs" });
  if (!lecteur) return NextResponse.json({ error: "Réservé au MJ." }, { status: 403 });
  const regions = await listVisibleMapRegions(supabase, blockId, lecteur.viewer, lecteur.campaignId);
  return NextResponse.json(regions, { status: 200 });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ blockId: string }> }) {
  const { blockId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = createMapRegionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Corps invalide." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const result = await createMapRegion(supabase, {
    blockId,
    name: parsed.data.name,
    ref: parsed.data.ref,
    shape: parsed.data.shape,
    fillColor: parsed.data.fillColor,
    borderColor: parsed.data.borderColor,
    layerId: parsed.data.layerId,
    fogGated: parsed.data.fogGated,
    visibilityLevel: parsed.data.visibility.level,
    visibilityScopeId: parsed.data.visibility.scopeId,
    createdBy: user.id,
  });

  if (!result.ok) {
    if (result.reason === "not_found") {
      return NextResponse.json({ error: "Bloc introuvable." }, { status: 404 });
    }
    return NextResponse.json({ error: "Vous n'avez pas le droit de modifier cette carte." }, { status: 403 });
  }

  return NextResponse.json(result.region, { status: 201 });
}
