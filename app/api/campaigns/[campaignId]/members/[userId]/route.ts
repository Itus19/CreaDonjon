import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { revokeCampaignMemberAccess } from "@/src/server/services/campaigns";

/**
 * Revoque un membre (V3.1-10) : expulse du monde, libere son personnage,
 * ne touche jamais au lien d'invitation — un lien joueur reste reutilisable
 * par d'autres (ADR 0031). Le droit est verifie a l'interieur de la
 * fonction SQL (`app.revoke_campaign_member`), pas ici. Vaut aussi pour un
 * second MJ (V3.1-15) ; le createur du monde, lui, est toujours refuse par
 * cette meme fonction (migration 20261001130000).
 */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ campaignId: string; userId: string }> }) {
  const { campaignId, userId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const result = await revokeCampaignMemberAccess(supabase, { campaignId, userId });
  if (!result.allowed) {
    return NextResponse.json({ error: "Action non autorisée." }, { status: 403 });
  }
  return NextResponse.json(result, { status: 200 });
}
