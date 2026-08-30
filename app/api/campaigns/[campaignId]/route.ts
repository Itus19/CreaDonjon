import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateCampaignSchema } from "@/lib/campaigns/schemas";
import {
  getCampaign,
  getCampaignGrants,
  getCampaignCharacters,
  getCampaignMembers,
  getCampaignRulesetOrigin,
  setCampaignMode,
} from "@/src/server/services/campaigns";
import { getDisplayNamesForUsers } from "@/src/server/repos/activityJournal";
import { isSuperadmin } from "@/src/server/services/account";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  const supabase = await createClient();

  const campaign = await getCampaign(supabase, campaignId);
  if (!campaign) {
    return NextResponse.json({ error: "Campagne introuvable." }, { status: 404 });
  }

  const [members, characters, rulesetContentOrigin, grants] = await Promise.all([
    getCampaignMembers(supabase, campaignId),
    getCampaignCharacters(supabase, campaignId),
    getCampaignRulesetOrigin(supabase, campaignId),
    getCampaignGrants(supabase, campaign.worldId),
  ]);

  // Noms affichables (V2-M9, retour utilisateur : "voir qu'est-ce qui est
  // deja permis ou non") plutot que l'uuid brut deja affiche partout
  // ailleurs dans ce panneau — une seule resolution groupee, jamais un
  // aller-retour par ligne.
  const userIds = [...members.map((m) => m.user_id), ...characters.flatMap((c) => (c.user_id ? [c.user_id] : []))];
  const displayNames = Object.fromEntries(await getDisplayNamesForUsers(supabase, userIds));

  return NextResponse.json({ campaign, members, characters, rulesetContentOrigin, grants, displayNames }, { status: 200 });
}

/** Mode modifiable apres creation (V2-G1 prepa, "un monde = une campagne") — seul endpoint d'ecriture de ce fichier jusqu'ici. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateCampaignSchema.safeParse(body);
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

  // V2-M2 (Lot M) : basculer une campagne existante en solo est refuse au
  // meme titre qu'en creer une directement en solo — meme verrou, deux
  // points d'entree.
  if (parsed.data.mode === "solo" && !(await isSuperadmin(supabase, user.id))) {
    return NextResponse.json({ error: "Le mode solo est réservé au superadmin." }, { status: 403 });
  }

  const updated = await setCampaignMode(supabase, { campaignId, mode: parsed.data.mode, actorUserId: user.id });
  if (!updated) {
    return NextResponse.json({ error: "Campagne introuvable." }, { status: 404 });
  }
  return NextResponse.json(updated, { status: 200 });
}
