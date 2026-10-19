import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assignJournalEntrySchema } from "@/lib/sessionJournal/schemas";
import { assignJournalEntry, listJournalAssignments } from "@/src/server/services/sessionJournal";
import { listCampaignRealSessions } from "@/src/server/services/scheduling";

/** Devoirs d'une campagne (V2.1-3) — en attente et rédigés, pour le panneau MJ ; avec les séances réelles (V3.1-43). */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  const parsedCampaign = z.string().uuid().safeParse((await params).campaignId);
  if (!parsedCampaign.success) {
    return NextResponse.json({ error: "Campagne introuvable." }, { status: 404 });
  }
  const campaignId = parsedCampaign.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  // V3.1-43 : les séances réelles arrivent avec les devoirs (une requête de plus côté serveur, aucune côté écran).
  const [assignments, realSessions] = await Promise.all([listJournalAssignments(supabase, campaignId), listCampaignRealSessions(supabase, campaignId)]);
  return NextResponse.json({ assignments, realSessions }, { status: 200 });
}

/** Assigne un devoir (réservé au MJ, appliqué par la RLS de `session_journal_entries`). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  const parsedCampaign = z.string().uuid().safeParse((await params).campaignId);
  if (!parsedCampaign.success) {
    return NextResponse.json({ error: "Campagne introuvable." }, { status: 404 });
  }
  const campaignId = parsedCampaign.data;

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
