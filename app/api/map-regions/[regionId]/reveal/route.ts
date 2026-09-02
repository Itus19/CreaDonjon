import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { revealMapRegion } from "@/src/server/services/mapRegionReveals";

/** Revele une zone `fog_gated` pour la campagne du monde qui la porte (V2-I2, brouillard de guerre). */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ regionId: string }> }) {
  const { regionId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const result = await revealMapRegion(supabase, { regionId, userId: user.id });
  if (!result.ok) {
    if (result.reason === "not_found") {
      return NextResponse.json({ error: "Zone introuvable." }, { status: 404 });
    }
    if (result.reason === "no_campaign") {
      return NextResponse.json({ error: "Ce monde n'a pas encore de campagne." }, { status: 409 });
    }
    return NextResponse.json({ error: "Vous n'avez pas le droit de modifier cette carte." }, { status: 403 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
