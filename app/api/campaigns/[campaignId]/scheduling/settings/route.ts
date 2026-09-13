import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { targetDurationSchema } from "@/lib/scheduling/schemas";
import { getTargetSessionMinutes, setTargetSessionMinutes } from "@/src/server/services/scheduling";

/** Durée de session visée (retour utilisateur : réglable par table, pas figée à 5h). */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const minutes = await getTargetSessionMinutes(supabase, campaignId);
  return NextResponse.json({ minutes }, { status: 200 });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = targetDurationSchema.safeParse(body);
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

  await setTargetSessionMinutes(supabase, campaignId, parsed.data.minutes);
  return NextResponse.json({ minutes: parsed.data.minutes }, { status: 200 });
}
