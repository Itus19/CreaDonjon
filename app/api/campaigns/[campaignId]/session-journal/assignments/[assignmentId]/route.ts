import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { cancelJournalAssignment } from "@/src/server/services/sessionJournal";

/** Annule un devoir encore en cours et efface sa page (réservé au MJ, RLS de `session_journal_entries`). */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ campaignId: string; assignmentId: string }> }) {
  const parsedIds = z.object({ campaignId: z.uuid(), assignmentId: z.uuid() }).safeParse(await params);
  if (!parsedIds.success) {
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
  // V3.1-150 : un devoir rendu ne s'annule plus ; annuler efface aussi la page jamais publiée.
  const result = await cancelJournalAssignment(supabase, { id: parsedIds.data.assignmentId, campaignId: parsedIds.data.campaignId, callerId: user.id });
  if (!result.ok) {
    const refus = {
      not_found: { status: 404, error: "Devoir introuvable." },
      forbidden: { status: 403, error: "Seul le MJ annule un devoir." },
      already_submitted: { status: 409, error: "Ce devoir a été rendu : il ne s'annule plus." },
    }[result.reason];
    return NextResponse.json({ error: refus.error }, { status: refus.status });
  }
  return new NextResponse(null, { status: 204 });
}
