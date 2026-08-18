import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { patchCombatSchema } from "@/lib/combats/schemas";
import { deleteCombatById, getCombatDetail, renameCombat, setCombatStatus } from "@/src/server/services/combats";

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

/** Renommage et/ou changement de statut manuel (V1-E4) — le MJ peut choisir librement parmi "Pas engagé"/"Commencé"/"Terminé". */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ combatId: string }> }) {
  const { combatId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = patchCombatSchema.safeParse(body);
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

  let combat = null;
  if (parsed.data.name !== undefined) {
    combat = await renameCombat(supabase, { combatId, name: parsed.data.name });
  }
  if (parsed.data.status !== undefined) {
    combat = await setCombatStatus(supabase, { combatId, status: parsed.data.status, actorUserId: user.id });
  }
  return NextResponse.json(combat, { status: 200 });
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
