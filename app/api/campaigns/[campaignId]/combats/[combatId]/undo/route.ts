import { NextResponse, type NextRequest } from "next/server";
import { guardCombatRoute } from "@/lib/combats/routeGuard";
import { undoLastCombatAction } from "@/src/server/services/combats";

/** "Annuler la derniere action" (Ctrl+Z, specs/outils-mj.md §5.3). MJ seulement (V3.1-101). */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ campaignId: string; combatId: string }> }) {
  const guard = await guardCombatRoute(params);
  if (!guard.ok) return guard.response;

  const undone = await undoLastCombatAction(guard.supabase, guard.params.combatId!, guard.userId);
  if (!undone) {
    return NextResponse.json({ error: "Rien à annuler." }, { status: 400 });
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
