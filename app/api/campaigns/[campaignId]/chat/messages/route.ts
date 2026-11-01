import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { chatMessageInputSchema } from "@/src/core/schemas/chat";
import { getCampaignById, listCampaignMembers } from "@/src/server/repos/campaigns";
import { getDisplayNamesForUsers } from "@/src/server/repos/activityJournal";
import { insertChatMessage, listChatMessagesForThread } from "@/src/server/repos/chatMessages";
import { listDiceRollsForCampaign } from "@/src/server/repos/diceRolls";
import { resolveThreadUserId } from "@/src/server/services/chat";
import { isWorldAdmin } from "@/src/server/services/permissions";
import { rollDetailForReader } from "@/src/core/dice/rollForReader";
import { chatMessagesQuerySchema, chatReadQuerySchema, searchParamsToObject } from "@/lib/queryParams/schemas";

/**
 * Fil MJ/joueur (V2-M13, "un fenetre de chat par joueur") — un joueur ne
 * voit toujours que son propre fil ; le MJ doit designer un joueur via
 * `?avec=<userId>` (`resolveThreadUserId`, seule source de verite sur qui
 * a le droit de voir quel fil — jamais duplique ici).
 *
 * V3.1-22 (ADR 0038) : `?fil=salon` rend le salon de table, avec les derniers
 * jets de la campagne (`rolls`), lus dans `dice_rolls` et jamais recopies en
 * message : le client les intercale par l'heure. La RLS ne rend a un joueur
 * que les jets publics et les siens ; un verdict contre un DD prive ne lui
 * est pas envoye (`rollDetailForReader`).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  const parsedQuery = chatMessagesQuerySchema.safeParse(searchParamsToObject(request.nextUrl.searchParams));
  if (!parsedQuery.success) {
    return NextResponse.json({ error: parsedQuery.error.issues[0]?.message ?? "Parametres invalides." }, { status: 400 });
  }
  const { limit, avec, fil: filDemande } = parsedQuery.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const campaign = await getCampaignById(supabase, campaignId);
  if (!campaign) {
    return NextResponse.json({ error: "Campagne introuvable." }, { status: 404 });
  }

  const fil = await resolveThreadUserId(supabase, {
    worldId: campaign.world_id,
    campaignId,
    callerId: user.id,
    requestedThreadUserId: avec ?? null,
    salon: filDemande === "salon",
  });
  if (!fil.ok) {
    return NextResponse.json({ error: "Fil introuvable." }, { status: 404 });
  }
  const threadUserId = fil.threadUserId;

  const [messages, members, rolls, isGm] = await Promise.all([
    listChatMessagesForThread(supabase, { campaignId, threadUserId, limit }),
    listCampaignMembers(supabase, campaignId),
    threadUserId === null ? listDiceRollsForCampaign(supabase, { campaignId, limit }) : Promise.resolve([]),
    isWorldAdmin(supabase, { worldId: campaign.world_id, userId: user.id }),
  ]);
  const names = await getDisplayNamesForUsers(supabase, members.map((m) => m.user_id));
  const membersOut = members.map((m) => ({ userId: m.user_id, displayName: names.get(m.user_id) ?? "?", role: m.role }));
  const rollsOut = rolls.map((r) => ({ ...r, detail: rollDetailForReader(r.detail, { isGm }) }));

  return NextResponse.json({ messages, members: membersOut, rolls: rollsOut, threadUserId }, { status: 200 });
}

/** Envoi d'un message (V2-M13, V3.1-22) — `sender_id` toujours l'appelant authentifie ; le fil cible (salon ou fil prive) passe par `resolveThreadUserId`, jamais un champ du corps (RLS `campaign_chat_messages_insert` le verifie de toute facon en second recours). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;

  const parsedQuery = chatReadQuerySchema.safeParse(searchParamsToObject(request.nextUrl.searchParams));
  if (!parsedQuery.success) {
    return NextResponse.json({ error: parsedQuery.error.issues[0]?.message ?? "Parametres invalides." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = chatMessageInputSchema.safeParse(body);
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

  const campaign = await getCampaignById(supabase, campaignId);
  if (!campaign) {
    return NextResponse.json({ error: "Campagne introuvable." }, { status: 404 });
  }

  const fil = await resolveThreadUserId(supabase, {
    worldId: campaign.world_id,
    campaignId,
    callerId: user.id,
    requestedThreadUserId: parsedQuery.data.avec ?? null,
    salon: parsedQuery.data.fil === "salon",
  });
  if (!fil.ok) {
    return NextResponse.json({ error: "Fil introuvable." }, { status: 404 });
  }

  const message = await insertChatMessage(supabase, {
    campaignId,
    senderId: user.id,
    threadUserId: fil.threadUserId,
    body: parsed.data.body,
  });
  return NextResponse.json(message, { status: 200 });
}
