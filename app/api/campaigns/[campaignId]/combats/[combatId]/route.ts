import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deleteCombatById, getCombatDetail } from "@/src/server/services/combats";

/** Combat + participants tries par initiative (V1-E4). */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ combatId: string }> }) {
  const { combatId } = await params;
  const supabase = await createClient();
  const detail = await getCombatDetail(supabase, combatId);
  if (!detail) {
    return NextResponse.json({ error: "Combat introuvable." }, { status: 404 });
  }
  return NextResponse.json(detail, { status: 200 });
}

/** Suppression definitive depuis "Mes combats" (V1-E4). */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ combatId: string }> }) {
  const { combatId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }
  await deleteCombatById(supabase, combatId);
  return NextResponse.json({ ok: true }, { status: 200 });
}
