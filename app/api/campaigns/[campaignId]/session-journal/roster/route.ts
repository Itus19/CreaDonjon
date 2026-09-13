import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listJournalRoster } from "@/src/server/services/sessionJournal";

/** Joueuses assignables du devoir (V2.1-3) — pour le sélecteur du panneau MJ. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const roster = await listJournalRoster(supabase, campaignId, user.id);
  return NextResponse.json({ roster }, { status: 200 });
}
