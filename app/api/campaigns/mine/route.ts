import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listMyGmCampaignsWithMembers } from "@/src/server/services/campaigns";

/** Campagnes dont l'utilisateur courant est MJ, mondes confondus (V2-K7, onglet Collaboration des Reglages). */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const campaigns = await listMyGmCampaignsWithMembers(supabase, user.id);
  return NextResponse.json({ campaigns }, { status: 200 });
}
