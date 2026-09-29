import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { setAvailabilitySchema } from "@/lib/scheduling/schemas";
import { getMyResponsesForRequest, getOpenRequest, respondToOpenRequest } from "@/src/server/services/scheduling";

/** Mes réponses à la ronde ouverte (V3.1-8) — jamais celles des autres, jamais sur une date hors proposition du MJ. `availabilities: []` si aucune ronde n'est ouverte. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const request = await getOpenRequest(supabase, campaignId);
  if (!request) return NextResponse.json({ availabilities: [] }, { status: 200 });

  const availabilities = await getMyResponsesForRequest(supabase, request.id, user.id);
  return NextResponse.json({ availabilities }, { status: 200 });
}

/** Pose (ou remplace) ma disponibilité d'un jour candidat de la ronde ouverte — une seule plage par jour (retour utilisateur). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = setAvailabilitySchema.safeParse(body);
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

  const result = await respondToOpenRequest(supabase, { campaignId, userId: user.id, ...parsed.data });
  if (!result.ok) {
    const messages = { no_open_request: "Aucune demande de disponibilités n'est ouverte.", date_not_candidate: "Cette date ne fait pas partie de la demande en cours." };
    return NextResponse.json({ error: messages[result.reason] }, { status: 409 });
  }
  return NextResponse.json(result.availability, { status: 200 });
}
