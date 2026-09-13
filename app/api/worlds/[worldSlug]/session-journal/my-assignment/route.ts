import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { resolveCampaignId } from "@/src/server/services/campaigns";
import { getMyPendingJournalAssignmentLabel } from "@/src/server/services/sessionJournal";

/**
 * Devoir en attente de ce compte (V2.1-3, retour utilisateur : bannière côté
 * joueuse) — résout le monde en campagne côté serveur, même motif que
 * `scheduling/next-session`.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) {
    return NextResponse.json({ error: "Monde introuvable." }, { status: 404 });
  }

  const campaignId = await resolveCampaignId(supabase, world.id);
  if (!campaignId) {
    return NextResponse.json({ assignment: null }, { status: 200 });
  }

  const assignment = await getMyPendingJournalAssignmentLabel(supabase, { worldId: world.id, campaignId, userId: user.id });
  return NextResponse.json({ assignment }, { status: 200 });
}
