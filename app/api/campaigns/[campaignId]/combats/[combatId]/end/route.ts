import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { endCombat } from "@/src/server/services/combats";

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
    const combat = await endCombat(supabase, { combatId, actorUserId: user.id });
    return NextResponse.json(combat, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Combat introuvable." }, { status: 404 });
  }
}
