import { NextResponse, type NextRequest } from "next/server";
import { guardCombatRoute } from "@/lib/combats/routeGuard";
import { turnSchema } from "@/lib/combats/schemas";
import { advanceCombatTurn, retreatCombatTurn } from "@/src/server/services/combats";
import { EmptyCombatError } from "@/src/core/rules/combat";

/** Tour suivant / precedent. MJ seulement (V3.1-101). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ campaignId: string; combatId: string }> }) {
  const guard = await guardCombatRoute(params);
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = turnSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Corps invalide." }, { status: 400 });
  }

  try {
    const move = parsed.data.direction === "next" ? advanceCombatTurn : retreatCombatTurn;
    const combat = await move(guard.supabase, { combatId: guard.params.combatId!, actorUserId: guard.userId });
    return NextResponse.json(combat, { status: 200 });
  } catch (error) {
    if (error instanceof EmptyCombatError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Combat introuvable." }, { status: 404 });
  }
}
