import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { beginCombat } from "@/src/server/services/combats";
import { EmptyCombatError } from "@/src/core/rules/combat";

/** Passe le combat en cours ("Go", V1-E4) — round 1, premier participant de l'ordre d'initiative. */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ combatId: string }> }) {
  const { combatId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  try {
    const combat = await beginCombat(supabase, { combatId, actorUserId: user.id });
    return NextResponse.json(combat, { status: 200 });
  } catch (error) {
    if (error instanceof EmptyCombatError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Combat introuvable." }, { status: 404 });
  }
}
