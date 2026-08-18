import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { turnSchema } from "@/lib/combats/schemas";
import { advanceCombatTurn, retreatCombatTurn } from "@/src/server/services/combats";
import { EmptyCombatError } from "@/src/core/rules/combat";

export async function POST(request: NextRequest, { params }: { params: Promise<{ combatId: string }> }) {
  const { combatId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = turnSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Corps invalide." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  try {
    const move = parsed.data.direction === "next" ? advanceCombatTurn : retreatCombatTurn;
    const combat = await move(supabase, { combatId, actorUserId: user.id });
    return NextResponse.json(combat, { status: 200 });
  } catch (error) {
    if (error instanceof EmptyCombatError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Combat introuvable." }, { status: 404 });
  }
}
