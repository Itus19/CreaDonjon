import { NextResponse, type NextRequest } from "next/server";
import { guardCombatRoute } from "@/lib/combats/routeGuard";
import { patchCombatSchema } from "@/lib/combats/schemas";
import { deleteCombatById, getCombatDetail, renameCombat, setCombatStatus } from "@/src/server/services/combats";

type Params = { params: Promise<{ campaignId: string; combatId: string }> };

/** Combat + participants tries par initiative (V1-E4). MJ seulement (V3.1-101) : les joueurs auront leur vue filtree (V3.1-102). */
export async function GET(_request: NextRequest, { params }: Params) {
  const guard = await guardCombatRoute(params);
  if (!guard.ok) return guard.response;

  const detail = await getCombatDetail(guard.supabase, guard.params.combatId!);
  if (!detail) {
    return NextResponse.json({ error: "Combat introuvable." }, { status: 404 });
  }
  return NextResponse.json(detail, { status: 200 });
}

/** Renommage et/ou changement de statut manuel (V1-E4) — le MJ peut choisir librement parmi "Pas engagé"/"Commencé"/"Terminé". */
export async function PATCH(request: NextRequest, { params }: Params) {
  const guard = await guardCombatRoute(params);
  if (!guard.ok) return guard.response;
  const { supabase, userId, params: p } = guard;

  const body = await request.json().catch(() => null);
  const parsed = patchCombatSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Corps invalide." }, { status: 400 });
  }

  let combat = null;
  if (parsed.data.name !== undefined) {
    combat = await renameCombat(supabase, { combatId: p.combatId!, name: parsed.data.name });
  }
  if (parsed.data.status !== undefined) {
    combat = await setCombatStatus(supabase, { combatId: p.combatId!, status: parsed.data.status, actorUserId: userId });
  }
  return NextResponse.json(combat, { status: 200 });
}

/** Suppression definitive depuis "Mes combats" (V1-E4). */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const guard = await guardCombatRoute(params);
  if (!guard.ok) return guard.response;

  await deleteCombatById(guard.supabase, guard.params.combatId!);
  return NextResponse.json({ ok: true }, { status: 200 });
}
