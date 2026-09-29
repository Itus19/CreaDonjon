import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { forceMemberPasswordReset } from "@/src/server/services/campaigns";

/**
 * "Forcer une réinitialisation" (V3.1-10, ADR 0031 §5) : génère un jeton à
 * usage unique — jamais un mot de passe temporaire tapé à la main, jamais
 * de connexion automatique. Le lien (`/reinitialiser/[token]`) est à
 * remettre à la personne par un canal hors application, comme aujourd'hui.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ campaignId: string; userId: string }> }) {
  const { campaignId, userId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const result = await forceMemberPasswordReset(supabase, { campaignId, targetUserId: userId, actingUserId: user.id });
  if (!result.ok) {
    return NextResponse.json({ error: "Action non autorisée." }, { status: 403 });
  }
  return NextResponse.json({ url: `/reinitialiser/${result.token}` }, { status: 200 });
}
