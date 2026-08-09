import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { xpChangeSchema } from "@/lib/characterActions/schemas";
import { changeXp } from "@/src/server/services/characterActions";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: entityId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = xpChangeSchema.safeParse(body);
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

  await changeXp(supabase, {
    entityId,
    campaignId: parsed.data.campaignId,
    delta: parsed.data.delta,
    actorUserId: user.id,
  });

  return new NextResponse(null, { status: 204 });
}
