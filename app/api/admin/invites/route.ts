import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSuperadmin } from "@/src/server/services/account";
import { listAllInvitesForAdmin } from "@/src/server/services/campaignInvites";

/** V2-M6 (Lot M) — tous les liens d'invitation actifs, tous mondes confondus (`campaign_invites_select`, migration 20260830170001). */
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

  const invites = await listAllInvitesForAdmin(supabase);
  return NextResponse.json({ invites }, { status: 200 });
}
