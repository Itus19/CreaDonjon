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

/**
 * Révoque un lien (V2-M4 suite) — réservé aux MJ/propriétaires/éditeurs du
 * monde. Le droit est désormais vérifié DANS
 * `app.revoke_campaign_invite_access` (V2.1-25, migration 20260917100000),
 * qui est `security definer` : la RLS de l'appelant ne s'applique plus, la
 * fonction reproduit donc elle-même la borne `app.is_world_admin`.
 *
 * Depuis V2.1-25, révoquer **retire l'accès** et non plus seulement le
 * jeton : personnage libéré, adhésion supprimée, `world_members` avec pour
 * un lien MJ de niveau monde. Les deux panneaux qui appellent cette route
 * (`InviteLinkPanel` et `AdminPanel`) héritent du même comportement, et
 * demandent tous deux confirmation avant de l'appeler.
 */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ campaignId: string; inviteId: string }> }) {
  const { inviteId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const result = await revokeInvite(supabase, inviteId);
  if (!result.allowed) {
    return NextResponse.json({ error: "Lien introuvable, ou vous n'avez pas le droit de le révoquer." }, { status: 403 });
  }
  if (!result.revoked) {
    return NextResponse.json({ error: "Ce lien était déjà révoqué." }, { status: 404 });
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
