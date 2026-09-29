import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cancelAvailabilityRequest } from "@/src/server/services/scheduling";

/** Ferme une ronde sans confirmer de séance (V3.1-8, « Annuler la demande ») — réservé au MJ, appliqué par la RLS de `availability_requests`. */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ campaignId: string; requestId: string }> }) {
  const { requestId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  await cancelAvailabilityRequest(supabase, requestId);
  return NextResponse.json({ ok: true }, { status: 200 });
}
