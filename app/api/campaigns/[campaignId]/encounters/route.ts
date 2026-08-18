import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { saveEncounterSchema } from "@/lib/encounters/schemas";
import { listSavedEncounters, saveEncounter } from "@/src/server/services/encounters";

/** "Mes combats" (V1-E3, specs/outils-mj.md §4.3) — meme motif que les routes de campagne existantes. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  const supabase = await createClient();
  const encounters = await listSavedEncounters(supabase, campaignId);
  return NextResponse.json({ encounters }, { status: 200 });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = saveEncounterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Corps invalide." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const encounter = await saveEncounter(supabase, {
    campaignId,
    name: parsed.data.name,
    partySize: parsed.data.partySize,
    partyLevel: parsed.data.partyLevel,
    band: parsed.data.band,
    participants: parsed.data.participants,
    createdBy: user.id,
  });
  return NextResponse.json(encounter, { status: 201 });
}
