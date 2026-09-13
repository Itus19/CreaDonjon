import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assignJournalEntrySchema } from "@/lib/sessionJournal/schemas";
import { assignJournalEntry, listJournalAssignments } from "@/src/server/services/sessionJournal";

/** Devoirs d'une campagne (V2.1-3) — en attente et rédigés, pour le panneau MJ. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const assignments = await listJournalAssignments(supabase, campaignId);
  return NextResponse.json({ assignments }, { status: 200 });
}

/** Assigne un devoir (réservé au MJ, appliqué par la RLS de `session_journal_entries`). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = assignJournalEntrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Corps invalide." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const assignment = await assignJournalEntry(supabase, {
    campaignId,
    ingameDate: parsed.data.ingameDate,
    assignedTo: parsed.data.assignedTo,
    createdBy: user.id,
  });
  return NextResponse.json(assignment, { status: 201 });
}
