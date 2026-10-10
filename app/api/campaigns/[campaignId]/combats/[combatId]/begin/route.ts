import { NextResponse, type NextRequest } from "next/server";
import { guardCombatRoute } from "@/lib/combats/routeGuard";
import { beginCombat } from "@/src/server/services/combats";
import { EmptyCombatError } from "@/src/core/rules/combat";

/** Passe le combat en cours ("Go", V1-E4) — round 1, premier participant de l'ordre d'initiative. MJ seulement (V3.1-101). */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ campaignId: string; combatId: string }> }) {
  const guard = await guardCombatRoute(params);
  if (!guard.ok) return guard.response;
  const { supabase, userId, params: p } = guard;

  try {
    const combat = await beginCombat(supabase, { combatId: p.combatId!, actorUserId: userId });
    return NextResponse.json(combat, { status: 200 });
  } catch (error) {
    if (error instanceof EmptyCombatError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Combat introuvable." }, { status: 404 });
  }
}
