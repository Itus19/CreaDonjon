import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { setEventVisibilitySchema } from "@/lib/blocks/schemas";
import { setAttitudeEventVisibility } from "@/src/server/services/psyche";

/** Bascule "afficher au wiki" d'un souvenir de relation (V2, retour utilisateur point 5) — un seul champ modifiable. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = setEventVisibilitySchema.safeParse(body);
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

  await setAttitudeEventVisibility(supabase, eventId, parsed.data.isPublic);
  return NextResponse.json({ ok: true }, { status: 200 });
}
