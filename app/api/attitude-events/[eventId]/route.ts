import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { setEventVisibilitySchema } from "@/lib/blocks/schemas";
import { z } from "zod";
import { getAttitudeEventSourceId } from "@/src/server/repos/psyche";
import { setAttitudeEventVisibility } from "@/src/server/services/psyche";
import { canWriteRelationship } from "@/src/server/services/relationshipFace";

const zParams = z.object({ eventId: z.string().uuid() });

/** Bascule "afficher au wiki" d'un souvenir de relation (V2, retour utilisateur point 5) — un seul champ modifiable. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const parsedParams = zParams.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json({ error: "Adresse invalide." }, { status: 400 });
  const { eventId } = parsedParams.data;

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
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  // V3.1-71 : seul qui peut écrire sur la fiche source change ce qui part au wiki.
  const sourceEntityId = await getAttitudeEventSourceId(supabase, eventId);
  if (!sourceEntityId) return NextResponse.json({ error: "Souvenir introuvable." }, { status: 404 });
  if (!(await canWriteRelationship(supabase, { sourceEntityId, userId: user.id }))) {
    return NextResponse.json({ error: "Vous ne pouvez pas modifier cette fiche." }, { status: 403 });
  }

  await setAttitudeEventVisibility(supabase, eventId, parsed.data.isPublic);
  return NextResponse.json({ ok: true }, { status: 200 });
}
