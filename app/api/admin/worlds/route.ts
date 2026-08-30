import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSuperadmin } from "@/src/server/services/account";
import { listWorlds } from "@/src/server/services/worlds";

/** V2-M6 (Lot M) — sélecteur de monde de la section Administration : tous les mondes, pas seulement ceux du superadmin (`worlds_select`, migration 20260830180001). */
export async function GET() {
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

  const worlds = await listWorlds(supabase);
  return NextResponse.json({ worlds }, { status: 200 });
}
