import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSuperadmin } from "@/src/server/services/account";
import { getMergedJournalForWorld } from "@/src/server/services/activityJournal";

/** V2-M6 (Lot M) — journal fusionné (révisions de fiches + événements de jeu) pour UN monde, tous comptes confondus. */
export async function GET(request: NextRequest) {
  const worldId = request.nextUrl.searchParams.get("worldId");
  if (!worldId) {
    return NextResponse.json({ error: "worldId requis." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }
  if (!(await isSuperadmin(supabase, user.id))) {
    return NextResponse.json({ error: "Réservé au superadmin." }, { status: 403 });
  }

  const entries = await getMergedJournalForWorld(supabase, worldId);
  return NextResponse.json({ entries }, { status: 200 });
}
