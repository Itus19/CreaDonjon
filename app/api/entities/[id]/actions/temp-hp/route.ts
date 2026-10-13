import { NextResponse, type NextRequest } from "next/server";
import { guardSheetActionRoute } from "@/lib/characterActions/routeGuard";
import { tempHpChangeSchema } from "@/lib/characterActions/schemas";
import { changeTempHp } from "@/src/server/services/characterActions";

// Même porte que les PV (interrupteur « hp » de la table) : des PV temporaires sont des PV.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardSheetActionRoute(request, params, tempHpChangeSchema, "hp");
  if (!guard.ok) return guard.response;
  const { supabase, userId, entityId, body } = guard;

  await changeTempHp(supabase, {
    entityId,
    campaignId: body.campaignId,
    amount: body.amount,
    choice: body.choice,
    actorUserId: userId,
  });

  return new NextResponse(null, { status: 204 });
}
