import { NextResponse, type NextRequest } from "next/server";
import { guardSheetActionRoute } from "@/lib/characterActions/routeGuard";
import { inspirationChangeSchema } from "@/lib/characterActions/schemas";
import { changeInspiration } from "@/src/server/services/characterActions";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardSheetActionRoute(request, params, inspirationChangeSchema, "inspiration");
  if (!guard.ok) return guard.response;
  const { supabase, userId, entityId, body, settings } = guard;

  await changeInspiration(supabase, {
    entityId,
    campaignId: body.campaignId,
    delta: body.delta,
    // Plafond de la table en campagne (V3.1-108) ; hors campagne, celui du service.
    max: body.campaignId ? settings.inspiration_max : undefined,
    actorUserId: userId,
  });

  return new NextResponse(null, { status: 204 });
}
