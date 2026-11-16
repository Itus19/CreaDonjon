import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { clearAvailabilitySchema, requestIdSchema } from "@/lib/scheduling/schemas";
import { clearAvailability } from "@/src/server/services/scheduling";

/** Effacer ma plage d'un jour, pour une demande ouverte (V3.1-190 : `?requestId=`). */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ campaignId: string; date: string }> }) {
  const { campaignId, date } = await params;
  const parsed = clearAvailabilitySchema.safeParse({ date, requestId: request.nextUrl.searchParams.get("requestId") });
  if (!parsed.success || !requestIdSchema.safeParse(campaignId).success) {
    return NextResponse.json({ error: "Date ou demande invalide." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const ok = await clearAvailability(supabase, { campaignId, userId: user.id, ...parsed.data });
  if (!ok) return NextResponse.json({ error: "Cette demande de disponibilités n'est plus ouverte." }, { status: 409 });
  return new NextResponse(null, { status: 204 });
}
