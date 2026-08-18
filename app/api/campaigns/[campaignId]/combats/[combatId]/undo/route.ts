import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { undoLastCombatAction } from "@/src/server/services/combats";

/** "Annuler la derniere action" (Ctrl+Z, specs/outils-mj.md §5.3). */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ combatId: string }> }) {
  const { combatId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const undone = await undoLastCombatAction(supabase, combatId, user.id);
  if (!undone) {
    return NextResponse.json({ error: "Rien a annuler." }, { status: 400 });
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
