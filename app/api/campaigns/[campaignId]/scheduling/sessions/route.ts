import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createRealSessionSchema } from "@/lib/scheduling/schemas";
import { createRealSession, getPastSessions, getUpcomingSessions } from "@/src/server/services/scheduling";

/** Séances planifiées d'une campagne (V2.1-4) — à venir et historique (réservoir pour le futur Livre de séance, V2.1-3). */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const [upcoming, past] = await Promise.all([getUpcomingSessions(supabase, campaignId), getPastSessions(supabase, campaignId)]);
  return NextResponse.json({ upcoming, past }, { status: 200 });
}

/** Confirme une séance — depuis le classement de disponibilités ou manuellement (réservé au MJ, appliqué par la RLS de `real_sessions`). Aucune limite au nombre de séances par mois. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = createRealSessionSchema.safeParse(body);
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

  const session = await createRealSession(supabase, { campaignId, createdBy: user.id, ...parsed.data });
  return NextResponse.json(session, { status: 201 });
}
