import { NextResponse, type NextRequest } from "next/server";
import { guardSheetActionRoute } from "@/lib/characterActions/routeGuard";
import { conditionChangeSchema } from "@/lib/characterActions/schemas";
import { changeConditions } from "@/src/server/services/characterActions";

/** V3.1-34 (outil Table) : poser ou retirer un état. Interrupteur de table « conditions » pour un joueur ; le MJ a toujours la main. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardSheetActionRoute(request, params, conditionChangeSchema, "conditions");
  if (!guard.ok) return guard.response;
  const { supabase, userId, entityId, body } = guard;

  const result = await changeConditions(supabase, {
    entityId,
    campaignId: body.campaignId,
    add: body.add,
    remove: body.remove,
    actorUserId: userId,
  });
  return NextResponse.json(result, { status: 200 });
}
