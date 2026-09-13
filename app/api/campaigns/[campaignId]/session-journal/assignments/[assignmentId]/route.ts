import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cancelJournalAssignment } from "@/src/server/services/sessionJournal";

/** Annule un devoir en attente (réservé au MJ, RLS de `session_journal_entries`). */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ campaignId: string; assignmentId: string }> }) {
  const { assignmentId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  await cancelJournalAssignment(supabase, assignmentId);
  return new NextResponse(null, { status: 204 });
}
