import { NextResponse, type NextRequest } from "next/server";
import { guardSheetActionRoute } from "@/lib/characterActions/routeGuard";
import { breakConcentrationSchema } from "@/lib/characterActions/schemas";
import { breakConcentration } from "@/src/server/services/concentration";

/**
 * V3.1-34 (outil Table) : « Rompre » la concentration, par le point unique
 * `setConcentration` (ADR 0036 §3). Même interrupteur que les états.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardSheetActionRoute(request, params, breakConcentrationSchema, "conditions");
  if (!guard.ok) return guard.response;
  const { supabase, userId, entityId, body } = guard;

  const change = await breakConcentration(supabase, { entityId, campaignId: body.campaignId, actorUserId: userId });
  return NextResponse.json({ broken: change.broken?.label ?? null }, { status: 200 });
}
