import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { setCampaignInvitePasswordSchema } from "@/lib/campaignInvites/schemas";
import { getMyInvite, setInvitePassword } from "@/src/server/services/campaignInvites";

/**
 * « Mon lien d'invitation » (V2-M4 suite, retour utilisateur 30 août) —
 * l'écran en libre-service d'un ami invité pour son PROPRE lien, jamais
 * celui d'un autre (`campaign_invites_select_own`, RLS). `null` pour un
 * compte qui n'a rejoint par aucun lien (le superadmin lui-même, par
 * exemple) — pas une erreur.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const invite = await getMyInvite(supabase, user.id);
  return NextResponse.json({ invite }, { status: 200 });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const invite = await getMyInvite(supabase, user.id);
  if (!invite) {
    return NextResponse.json({ error: "Aucun lien d'invitation associé à ce compte." }, { status: 404 });
  }

  const parsed = setCampaignInvitePasswordSchema.safeParse({ ...body, inviteId: invite.id });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Corps invalide." }, { status: 400 });
  }

  const { allowed } = await setInvitePassword(supabase, { inviteId: invite.id, password: parsed.data.password || null });
  if (!allowed) {
    return NextResponse.json({ error: "Vous n'avez pas le droit de modifier ce lien." }, { status: 403 });
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
