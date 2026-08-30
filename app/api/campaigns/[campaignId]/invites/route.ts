import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createCampaignInviteSchema } from "@/lib/campaignInvites/schemas";
import { createCampaignInvite } from "@/src/server/services/campaignInvites";

/**
 * Génère un lien d'invitation nominatif (V2-M4, Lot M) — un par ami,
 * retour utilisateur 29 août. Réservé aux MJ/propriétaires/éditeurs du
 * monde (`campaign_invites_write`, RLS) : un simple joueur qui forge cette
 * requête reçoit une erreur d'écriture, jamais un lien fonctionnel.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = createCampaignInviteSchema.safeParse({ ...body, campaignId });
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

  try {
    const { invite, token } = await createCampaignInvite(supabase, {
      campaignId,
      worldId: null,
      intendedRole: parsed.data.intendedRole,
      createdBy: user.id,
    });
    return NextResponse.json({ invite, token, url: `/rejoindre/${token}` }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Impossible de créer ce lien — seul le MJ propriétaire du monde peut inviter." },
      { status: 403 }
    );
  }
}
