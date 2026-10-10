import { NextResponse, type NextRequest } from "next/server";
import { guardSheetActionRoute } from "@/lib/characterActions/routeGuard";
import { hpChangeSchema } from "@/lib/characterActions/schemas";
import { changeHp } from "@/src/server/services/characterActions";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardSheetActionRoute(request, params, hpChangeSchema, "hp");
  if (!guard.ok) return guard.response;
  const { supabase, userId, entityId, body } = guard;

  await changeHp(supabase, {
    entityId,
    campaignId: body.campaignId,
    delta: body.delta,
    actorUserId: userId,
  });

  return new NextResponse(null, { status: 204 });
}
