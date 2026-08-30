import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { setCampaignInvitePasswordSchema } from "@/lib/campaignInvites/schemas";
import { revokeInvite, setInvitePassword } from "@/src/server/services/campaignInvites";

/**
 * Change/efface le mot de passe d'un lien (V2-M4 suite, retour utilisateur
 * 30 août : « seul le superadmin et la personne concernée peut le
 * changer »). Le droit est vérifié DANS `app.set_campaign_invite_password`
 * (RLS ne suffirait pas ici sans autoriser une écriture large sur toute la
 * ligne), pas ici — `allowed: false` distingue un compte sans droit d'un
 * jeton simplement introuvable.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ campaignId: string; inviteId: string }> }) {
  const { inviteId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = setCampaignInvitePasswordSchema.safeParse({ ...body, inviteId });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Corps invalide." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const { allowed } = await setInvitePassword(supabase, { inviteId, password: parsed.data.password || null });
  if (!allowed) {
    return NextResponse.json({ error: "Vous n'avez pas le droit de modifier ce lien." }, { status: 403 });
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}

/** Révoque un lien (V2-M4 suite) — réservé aux MJ/propriétaires/éditeurs du monde (`campaign_invites_write`, RLS). */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ campaignId: string; inviteId: string }> }) {
  const { inviteId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const { revoked } = await revokeInvite(supabase, inviteId);
  if (!revoked) {
    return NextResponse.json({ error: "Lien introuvable ou déjà révoqué." }, { status: 404 });
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
