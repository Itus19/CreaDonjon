import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { openAvailabilityRequestSchema } from "@/lib/scheduling/schemas";
import { openAvailabilityRequest } from "@/src/server/services/scheduling";

/** Ouvre une ronde de demande de disponibilités (V3.1-8) — réservé au MJ, appliqué par la RLS de `availability_requests`. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = openAvailabilityRequestSchema.safeParse(body);
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

  const result = await openAvailabilityRequest(supabase, {
    campaignId,
    title: parsed.data.title ?? null,
    candidateDates: parsed.data.candidateDates,
    startsAt: parsed.data.startsAt,
    endsAt: parsed.data.endsAt,
    createdBy: user.id,
  });
  if (!result.ok) {
    return NextResponse.json({ error: "Une demande est déjà ouverte pour cette campagne." }, { status: 409 });
  }
  return NextResponse.json(result.request, { status: 201 });
}
