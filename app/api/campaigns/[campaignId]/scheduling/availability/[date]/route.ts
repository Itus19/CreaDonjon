import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { clearAvailabilitySchema } from "@/lib/scheduling/schemas";
import { deleteAvailability } from "@/src/server/services/scheduling";

/** Efface ma disponibilité d'un jour précis. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ campaignId: string; date: string }> }) {
  const { campaignId, date } = await params;
  const parsed = clearAvailabilitySchema.safeParse({ date });
  if (!parsed.success) {
    return NextResponse.json({ error: "Date invalide." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  await deleteAvailability(supabase, { campaignId, userId: user.id, date });
  return new NextResponse(null, { status: 204 });
}
