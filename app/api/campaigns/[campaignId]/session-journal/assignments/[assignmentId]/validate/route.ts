import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { validateJournalAssignment } from "@/src/server/services/sessionJournal";

const MESSAGES = {
  not_found: { status: 404, error: "Devoir introuvable." },
  forbidden: { status: 403, error: "Seul le MJ valide un devoir." },
  not_submitted: { status: 409, error: "Ce devoir n'est pas rendu, ou il est déjà validé." },
} as const;

/** Le MJ valide un devoir rendu (V3.1-150, ADR 0071) : la mention quitte la barre de l'autrice. */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ campaignId: string; assignmentId: string }> }) {
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

  const result = await validateJournalAssignment(supabase, { ...parsedIds.data, callerId: user.id });
  if (!result.ok) {
    const { status, error } = MESSAGES[result.reason];
    return NextResponse.json({ error }, { status });
  }
  return new NextResponse(null, { status: 204 });
}
