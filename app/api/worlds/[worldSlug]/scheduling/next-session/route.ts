import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { resolveCampaignId } from "@/src/server/services/campaigns";
import { getNextSession } from "@/src/server/services/scheduling";

/**
 * Prochaine séance affichée dans la barre latérale joueuse (V2.1-4, retour
 * utilisateur) — résout le monde en campagne côté serveur pour que
 * `PlayerShell.tsx` (qui n'a que `worldSlug`) n'ait pas besoin de porter
 * `campaignId` en plus.
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
    return NextResponse.json({ campaignId: null, session: null }, { status: 200 });
  }

  const session = await getNextSession(supabase, campaignId);
  return NextResponse.json({ campaignId, session }, { status: 200 });
}
