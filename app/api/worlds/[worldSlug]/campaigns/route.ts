import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createCampaignSchema } from "@/lib/campaigns/schemas";
import { createCampaign, listCampaigns } from "@/src/server/services/campaigns";
import { getWorldBySlug } from "@/src/server/services/worlds";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;
  const supabase = await createClient();

  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) {
    return NextResponse.json({ error: "Monde introuvable." }, { status: 404 });
  }

  const campaigns = await listCampaigns(supabase, world.id);
  return NextResponse.json({ campaigns }, { status: 200 });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;

  const body = await request.json().catch(() => null);
  const parsed = createCampaignSchema.safeParse(body);
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

  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) {
    return NextResponse.json({ error: "Monde introuvable." }, { status: 404 });
  }

  const campaign = await createCampaign(supabase, {
    worldId: world.id,
    createdBy: user.id,
    name: parsed.data.name,
    rulesetId: parsed.data.rulesetId,
    mode: parsed.data.mode,
  });
  return NextResponse.json(campaign, { status: 201 });
}
