import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCampaignById } from "@/src/server/repos/campaigns";
import { getPlayerStats } from "@/src/server/services/playerStats";
import { playerStatsQuerySchema, searchParamsToObject } from "@/lib/queryParams/schemas";

/**
 * V3.1-91 — Les statistiques de la joueuse qui appelle (« Tes dés et tes
 * titres ») : son personnage réclamé dans cette campagne, résolu par le
 * serveur (aucun identifiant de personnage n'est accepté). Seule l'entrée
 * `scope` vient du client, validée par Zod.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  const parsed = playerStatsQuerySchema.safeParse(searchParamsToObject(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Parametres invalides." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }
  // La RLS de `campaigns` ne rend la campagne qu'à ses membres.
  const campaign = await getCampaignById(supabase, campaignId);
  if (!campaign) {
    return NextResponse.json({ error: "Campagne introuvable." }, { status: 404 });
  }

  const stats = await getPlayerStats(supabase, { campaignId, userId: user.id, scope: parsed.data.scope });
  return NextResponse.json(stats, { status: 200 });
}
