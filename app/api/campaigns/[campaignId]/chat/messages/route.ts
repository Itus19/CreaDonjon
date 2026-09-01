import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { chatMessageInputSchema } from "@/src/core/schemas/chat";
import { getCampaignById, listCampaignMembers } from "@/src/server/repos/campaigns";
import { getDisplayNamesForUsers } from "@/src/server/repos/activityJournal";
import { listEntitiesByIds } from "@/src/server/repos/entities";
import { insertChatMessage, listChatMessagesForThread } from "@/src/server/repos/chatMessages";
import { resolveThreadUserId } from "@/src/server/services/chat";

const HISTORY_LIMIT_DEFAULT = 50;
const HISTORY_LIMIT_MAX = 200;

/**
 * Fil MJ/joueur (V2-M13, "un fenetre de chat par joueur") — un joueur ne
 * voit toujours que son propre fil ; le MJ doit designer un joueur via
 * `?avec=<userId>` (`resolveThreadUserId`, seule source de verite sur qui
 * a le droit de voir quel fil — jamais duplique ici). `relatedEntities`
 * accompagne la liste pour afficher "Depuis : <fiche>" sur les messages
 * envoyes via "Demande de modif au MJ".
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  const requested = Number(request.nextUrl.searchParams.get("limit") ?? HISTORY_LIMIT_DEFAULT);
  const limit = Number.isFinite(requested) ? Math.min(Math.max(Math.trunc(requested), 1), HISTORY_LIMIT_MAX) : HISTORY_LIMIT_DEFAULT;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const campaign = await getCampaignById(supabase, campaignId);
  if (!campaign) {
    return NextResponse.json({ error: "Campagne introuvable." }, { status: 404 });
  }

  const threadUserId = await resolveThreadUserId(supabase, {
    worldId: campaign.world_id,
    campaignId,
    callerId: user.id,
    requestedThreadUserId: request.nextUrl.searchParams.get("avec"),
  });
  if (!threadUserId) {
    return NextResponse.json({ error: "Fil introuvable." }, { status: 404 });
  }

  const [messages, members] = await Promise.all([
    listChatMessagesForThread(supabase, { campaignId, threadUserId, limit }),
    listCampaignMembers(supabase, campaignId),
  ]);
  const names = await getDisplayNamesForUsers(supabase, members.map((m) => m.user_id));
  const membersOut = members.map((m) => ({ userId: m.user_id, displayName: names.get(m.user_id) ?? "?", role: m.role }));

  const relatedEntityIds = [...new Set(messages.map((m) => m.related_entity_id).filter((id): id is string => id !== null))];
  const relatedEntities =
    relatedEntityIds.length > 0
      ? (await listEntitiesByIds(supabase, relatedEntityIds)).map((e) => ({ id: e.id, name: e.name, slug: e.slug }))
      : [];

  return NextResponse.json({ messages, members: membersOut, relatedEntities, threadUserId }, { status: 200 });
}

/** Envoi d'un message (V2-M13) — `sender_id` toujours l'appelant authentifie ; le fil cible passe par `resolveThreadUserId`, jamais un champ du corps (RLS `campaign_chat_messages_insert` le verifie de toute facon en second recours). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;

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
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const campaign = await getCampaignById(supabase, campaignId);
  if (!campaign) {
    return NextResponse.json({ error: "Campagne introuvable." }, { status: 404 });
  }

  const threadUserId = await resolveThreadUserId(supabase, {
    worldId: campaign.world_id,
    campaignId,
    callerId: user.id,
    requestedThreadUserId: request.nextUrl.searchParams.get("avec"),
  });
  if (!threadUserId) {
    return NextResponse.json({ error: "Fil introuvable." }, { status: 404 });
  }

  const message = await insertChatMessage(supabase, {
    campaignId,
    senderId: user.id,
    threadUserId,
    relatedEntityId: parsed.data.relatedEntityId ?? null,
    body: parsed.data.body,
  });
  return NextResponse.json(message, { status: 200 });
}
