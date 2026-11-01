import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { submitJournalAssignmentSchema } from "@/lib/sessionJournal/schemas";
import { submitMyJournalAssignment } from "@/src/server/services/sessionJournal";

const MESSAGES = {
  not_found: { status: 404, error: "Devoir introuvable." },
  forbidden: { status: 403, error: "Ce devoir ne vous est pas assigné." },
  already_submitted: { status: 409, error: "Ce devoir a déjà été rendu." },
  conflict: { status: 409, error: "La page a été modifiée entre-temps. Rechargez avant de réessayer." },
} as const;

/**
 * « Devoir fait » (V3.1-150, ADR 0071) : l'autrice rend son devoir — la page
 * devient publique et entre dans le Livre. Définitif. Le monde de l'adresse
 * ne donne aucun droit : le service vérifie que le devoir est celui de
 * l'appelante, et la base le revérifie (`submit_journal_assignment`).
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = submitJournalAssignmentSchema.safeParse(body);
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

  const result = await submitMyJournalAssignment(supabase, { assignmentId: parsed.data.assignmentId, userId: user.id });
  if (!result.ok) {
    const { status, error } = MESSAGES[result.reason];
    return NextResponse.json({ error }, { status });
  }
  return NextResponse.json({ slug: result.slug }, { status: 200 });
}
