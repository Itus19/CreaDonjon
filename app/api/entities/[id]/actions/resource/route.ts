import { NextResponse, type NextRequest } from "next/server";
import { guardSheetActionRoute } from "@/lib/characterActions/routeGuard";
import { resourceUsageSchema } from "@/lib/characterActions/schemas";
import { changeResourceUsage } from "@/src/server/services/characterActions";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardSheetActionRoute(request, params, resourceUsageSchema);
  if (!guard.ok) return guard.response;
  const { supabase, userId, entityId, body } = guard;

  await changeResourceUsage(supabase, {
    entityId,
    campaignId: body.campaignId,
    trackerId: body.trackerId,
    delta: body.delta,
    actorUserId: userId,
  });

  return new NextResponse(null, { status: 204 });
}
