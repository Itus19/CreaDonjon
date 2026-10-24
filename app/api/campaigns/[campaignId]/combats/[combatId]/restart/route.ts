import { NextResponse, type NextRequest } from "next/server";
import { guardCombatRoute } from "@/lib/combats/routeGuard";
import { restartCombat } from "@/src/server/services/combats";

/** « Recommencer » : initiatives effacées, retour aux jets, invitation renvoyée. MJ seulement (V3.1-38). 409 si le combat n'est pas dans le statut qui le permet. */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ campaignId: string; combatId: string }> }) {
  const guard = await guardCombatRoute(params);
  if (!guard.ok) return guard.response;

  const combat = await restartCombat(guard.supabase, { combatId: guard.params.combatId!, actorUserId: guard.userId });
  if (!combat) return NextResponse.json({ error: "Seul un combat suspendu se recommence." }, { status: 409 });
  return NextResponse.json(combat, { status: 200 });
}
