import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assignCharacterSchema } from "@/lib/campaigns/schemas";
import { assignCampaignCharacter } from "@/src/server/services/campaigns";

export async function POST(request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = assignCharacterSchema.safeParse(body);
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

  const character = await assignCampaignCharacter(supabase, {
    campaignId,
    entityId: parsed.data.entityId,
    userId: parsed.data.userId,
    isPc: parsed.data.isPc,
  });
  return NextResponse.json(character, { status: 201 });
}
