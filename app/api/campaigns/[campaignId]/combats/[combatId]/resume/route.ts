import { NextResponse, type NextRequest } from "next/server";
import { guardCombatRoute } from "@/lib/combats/routeGuard";
import { resumeCombat } from "@/src/server/services/combats";

/** « Reprendre tel quel » : même ordre, même round, même tour. MJ seulement (V3.1-38). 409 si le combat n'est pas dans le statut qui le permet. */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ campaignId: string; combatId: string }> }) {
  const guard = await guardCombatRoute(params);
  if (!guard.ok) return guard.response;

  const combat = await resumeCombat(guard.supabase, { combatId: guard.params.combatId!, actorUserId: guard.userId });
  if (!combat) return NextResponse.json({ error: "Seul un combat suspendu se reprend." }, { status: 409 });
  return NextResponse.json(combat, { status: 200 });
}
