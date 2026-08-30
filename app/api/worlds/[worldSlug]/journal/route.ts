import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { isWorldAdmin } from "@/src/server/services/permissions";
import { getMergedJournalForWorld } from "@/src/server/services/activityJournal";

/**
 * Journal fusionne filtre a CE monde (V2-M7, Lot M) — pendant "par monde" du
 * journal transversal du superadmin (V2-M6, `/api/admin/journal`). Meme
 * requete (`getMergedJournalForWorld`, deja generique a n'importe quel
 * monde), gate different : `isWorldAdmin` (proprietaire/editeur/MJ humain de
 * CE monde), jamais `isSuperadmin`.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) {
    return NextResponse.json({ error: "Monde introuvable." }, { status: 404 });
  }
  if (!(await isWorldAdmin(supabase, { worldId: world.id, userId: user.id }))) {
    return NextResponse.json({ error: "Reserve au MJ de ce monde." }, { status: 403 });
  }

  const entries = await getMergedJournalForWorld(supabase, world.id);
  return NextResponse.json({ entries }, { status: 200 });
}
