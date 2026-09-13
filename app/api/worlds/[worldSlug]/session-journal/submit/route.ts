import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { submitJournalEntrySchema } from "@/lib/sessionJournal/schemas";
import { submitMyJournalEntry } from "@/src/server/services/sessionJournal";

/** L'autrice assignée commence à rédiger (V2.1-3) — crée la fiche et renvoie son slug pour rediriger vers son édition normale. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;

  const body = await request.json().catch(() => null);
  const parsed = submitJournalEntrySchema.safeParse(body);
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

  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) {
    return NextResponse.json({ error: "Monde introuvable." }, { status: 404 });
  }

  const result = await submitMyJournalEntry(supabase, {
    assignmentId: parsed.data.assignmentId,
    worldId: world.id,
    userId: user.id,
    title: parsed.data.title,
  });
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 403 });
  }
  return NextResponse.json(result, { status: 201 });
}
