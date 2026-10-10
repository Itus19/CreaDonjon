import { NextResponse, type NextRequest } from "next/server";
import { guardCombatRoute } from "@/lib/combats/routeGuard";
import { endCombat } from "@/src/server/services/combats";

/** Termine le combat. MJ seulement (V3.1-101). */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ campaignId: string; combatId: string }> }) {
  const guard = await guardCombatRoute(params);
  if (!guard.ok) return guard.response;

  try {
    const combat = await endCombat(guard.supabase, { combatId: guard.params.combatId!, actorUserId: guard.userId });
    return NextResponse.json(combat, { status: 200 });
  } catch (error) {
    // L'acces est deja verifie : un echec ici est une erreur reelle, journalisee.
    console.error("Fin de combat en echec :", error);
    return NextResponse.json({ error: "Combat introuvable." }, { status: 404 });
  }
}
