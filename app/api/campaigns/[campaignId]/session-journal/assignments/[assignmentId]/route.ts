import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { cancelJournalAssignment } from "@/src/server/services/sessionJournal";

/** Annule un devoir en attente (réservé au MJ, RLS de `session_journal_entries`). */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ campaignId: string; assignmentId: string }> }) {
  const parsedId = z.string().uuid().safeParse((await params).assignmentId);
  if (!parsedId.success) {
    return NextResponse.json({ error: "Devoir introuvable." }, { status: 404 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  // V3.1-43 : journalisé seulement si un devoir a vraiment été effacé (la RLS réserve l'effacement au MJ).
  await cancelJournalAssignment(supabase, { id: parsedId.data, callerId: user.id });
  return new NextResponse(null, { status: 204 });
}
