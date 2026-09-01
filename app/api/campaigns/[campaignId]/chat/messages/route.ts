import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { chatMessageInputSchema } from "@/src/core/schemas/chat";
import { getCampaignById, listCampaignMembers } from "@/src/server/repos/campaigns";
import { getDisplayNamesForUsers } from "@/src/server/repos/activityJournal";
import { insertChatMessage, listChatMessagesForCampaign } from "@/src/server/repos/chatMessages";

const HISTORY_LIMIT_DEFAULT = 50;
const HISTORY_LIMIT_MAX = 200;

/**
 * Salon de campagne (V2-M12, retour utilisateur : "ajoute un outil de chat
 * avec le mj") — un seul salon partage par campagne (MJ + tous les
 * joueurs), RLS `campaign_chat_messages_select` filtre deja aux membres du
 * monde. `members` accompagne la liste pour que le client puisse nommer
 * l'auteur de CHAQUE message, y compris ceux qui arrivent plus tard par
 * Realtime (qui ne portent que `sender_id`, jamais un nom affiche).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  const requested = Number(request.nextUrl.searchParams.get("limit") ?? HISTORY_LIMIT_DEFAULT);
  const limit = Number.isFinite(requested) ? Math.min(Math.max(Math.trunc(requested), 1), HISTORY_LIMIT_MAX) : HISTORY_LIMIT_DEFAULT;

  const supabase = await createClient();
  const [messages, members] = await Promise.all([
    listChatMessagesForCampaign(supabase, { campaignId, limit }),
    listCampaignMembers(supabase, campaignId),
  ]);
  const names = await getDisplayNamesForUsers(supabase, members.map((m) => m.user_id));
  const membersOut = members.map((m) => ({ userId: m.user_id, displayName: names.get(m.user_id) ?? "?", role: m.role }));

  return NextResponse.json({ messages, members: membersOut }, { status: 200 });
}

/** Envoi d'un message (V2-M12) — `sender_id` toujours l'appelant authentifie, jamais un champ du corps (RLS `campaign_chat_messages_insert` le verifie de toute facon en second recours). */
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

  const message = await insertChatMessage(supabase, { campaignId, senderId: user.id, body: parsed.data.body });
  return NextResponse.json(message, { status: 200 });
}
