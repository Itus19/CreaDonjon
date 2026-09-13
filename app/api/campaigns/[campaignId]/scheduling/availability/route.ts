import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { setAvailabilitySchema } from "@/lib/scheduling/schemas";
import { listAvailabilitiesForUserInRange, upsertAvailability } from "@/src/server/services/scheduling";

const YEAR_AHEAD_DAYS = 366;

/** Mes disponibilités (V2.1-4) — sur un an à l'avance (retour utilisateur), jamais celles des autres (l'appelant ne voit ici que ses propres lignes). */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const from = new Date().toISOString().slice(0, 10);
  const to = new Date(Date.now() + YEAR_AHEAD_DAYS * 86_400_000).toISOString().slice(0, 10);
  const availabilities = await listAvailabilitiesForUserInRange(supabase, campaignId, user.id, from, to);
  return NextResponse.json({ availabilities }, { status: 200 });
}

/** Pose (ou remplace) ma disponibilité d'un jour — une seule plage par jour (retour utilisateur). */
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

  const availability = await upsertAvailability(supabase, { campaignId, userId: user.id, ...parsed.data });
  return NextResponse.json(availability, { status: 200 });
}
