import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { resolveCampaignId } from "@/src/server/services/campaigns";
import { getOpenRequest, hasRespondedToRequest, getMyResponsesForRequest } from "@/src/server/services/scheduling";

/**
 * Ronde de demande ouverte pour le monde de la joueuse (V3.1-8) — sert à la
 * fois la pastille du bouton « Prochaine session » (`hasResponded`) et
 * l'onglet « Mes disponibilités » (`request`, `myResponses`). Même motif
 * que `next-session/route.ts` : résout le monde en campagne côté serveur,
 * `PlayerShell.tsx`/`NextSessionBadge.tsx` n'ont que `worldSlug`.
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
    return NextResponse.json({ campaignId: null, request: null, hasResponded: false, myResponses: [] }, { status: 200 });
  }

  const request = await getOpenRequest(supabase, campaignId);
  if (!request) {
    return NextResponse.json({ campaignId, request: null, hasResponded: false, myResponses: [] }, { status: 200 });
  }

  const [hasResponded, myResponses] = await Promise.all([
    hasRespondedToRequest(supabase, request.id, user.id),
    getMyResponsesForRequest(supabase, request.id, user.id),
  ]);
  return NextResponse.json({ campaignId, request, hasResponded, myResponses }, { status: 200 });
}
