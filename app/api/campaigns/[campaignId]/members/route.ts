import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { inviteMemberSchema } from "@/lib/campaigns/schemas";
import { inviteCampaignMember } from "@/src/server/services/campaigns";

export async function POST(request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = inviteMemberSchema.safeParse(body);
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

  const result = await inviteCampaignMember(supabase, {
    campaignId,
    email: parsed.data.email,
    role: parsed.data.role,
  });
  if (!result.ok) {
    return NextResponse.json({ error: "Aucun compte n'existe pour cette adresse." }, { status: 404 });
  }
  return NextResponse.json(result, { status: 201 });
}
