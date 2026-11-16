import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requestIdSchema, setAvailabilitySchema } from "@/lib/scheduling/schemas";
import { respondToRequest } from "@/src/server/services/scheduling";

/**
 * Répondre à une demande (V3.1-8) : une plage pour un jour. V3.1-190 : la
 * demande est nommée (`requestId`), plusieurs pouvant être ouvertes ; le
 * service vérifie qu'elle est ouverte, de cette campagne, et que le jour en
 * fait partie. Mes réponses se lisent avec l'écran
 * (`requests/open`, `myResponses`).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  if (!requestIdSchema.safeParse(campaignId).success) {
    return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
  }

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

  const result = await respondToRequest(supabase, { campaignId, userId: user.id, ...parsed.data });
  if (!result.ok) {
    const messages: Record<typeof result.reason, string> = {
      no_open_request: "Cette demande de disponibilités n'est plus ouverte.",
      date_not_candidate: "Cette date ne fait pas partie de la demande.",
    };
    return NextResponse.json({ error: messages[result.reason] }, { status: 409 });
  }
  return NextResponse.json(result.availability, { status: 200 });
}
