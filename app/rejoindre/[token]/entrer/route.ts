import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { claimInvite, resolveDestinationForInvitedUser, resolveInviteForJoin } from "@/src/server/services/campaignInvites";

/**
 * Réouverture d'un lien déjà réclamé (V2-M4, Lot M) — depuis n'importe quel
 * appareil, sans jamais redemander rôle/nom/personnage : reconnecte
 * toujours le MÊME compte (specs/module-joueur-et-solo.md §A1). Une route
 * (pas un Server Component) parce qu'établir une session écrit des
 * cookies, impossible depuis le rendu d'une page.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();

  const resolved = await resolveInviteForJoin(supabase, token);
  if (!resolved.ok || !resolved.invite.claimedByUserId) {
    return NextResponse.redirect(new URL(`/rejoindre/${token}`, request.url));
  }

  const result = await claimInvite({ invite: resolved.invite });
  if (!result.ok) {
    return NextResponse.redirect(new URL(`/rejoindre/${token}`, request.url));
  }

  const { data: verified, error: verifyError } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: result.tokenHash,
  });
  if (verifyError || !verified.user) {
    return NextResponse.redirect(new URL(`/rejoindre/${token}`, request.url));
  }

  const destination = await resolveDestinationForInvitedUser(supabase, resolved.invite, verified.user.id);
  return NextResponse.redirect(new URL(destination, request.url));
}
