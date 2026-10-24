import { NextResponse, type NextRequest } from "next/server";
import { guardCombatRoute } from "@/lib/combats/routeGuard";
import { pauseCombat } from "@/src/server/services/combats";

/** « Quitter le combat » : suspend sans rien perdre. MJ seulement (V3.1-38). 409 si le combat n'est pas dans le statut qui le permet. */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ campaignId: string; combatId: string }> }) {
  const guard = await guardCombatRoute(params);
  if (!guard.ok) return guard.response;

  const combat = await pauseCombat(guard.supabase, { combatId: guard.params.combatId!, actorUserId: guard.userId });
  if (!combat) return NextResponse.json({ error: "Seul un combat en cours ou en jets d'initiative se suspend." }, { status: 409 });
  return NextResponse.json(combat, { status: 200 });
}
