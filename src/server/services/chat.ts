import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { isWorldAdmin } from "@/src/server/services/permissions";
import { listCampaignMembers } from "@/src/server/repos/campaigns";
import { getDisplayNamesForUsers } from "@/src/server/repos/activityJournal";
import {
  countUnreadInThread,
  listChatLastReadAtByThread,
  listLastMessagePerThread,
  type ChatMessageRow,
} from "@/src/server/repos/chatMessages";

type TypedClient = SupabaseClient<Database>;

export interface ChatThreadSummary {
  userId: string;
  displayName: string;
  lastMessage: ChatMessageRow | null;
  unreadCount: number;
}

/**
 * Quel fil cet appelant a le droit de consulter (V2-M13, "un fenetre de
 * chat par joueur") — un joueur ne voit JAMAIS que le sien, force a son
 * propre id sans lire quoi que ce soit du corps de la requete (jamais fait
 * confiance au client sur ce point, meme si RLS le refuserait de toute
 * facon en dernier recours). Le MJ doit designer explicitement un joueur de
 * CETTE campagne (`?avec=<userId>`) ; `null` si absent ou si ce n'est pas
 * un joueur de la campagne — la route appelante doit alors refuser.
 */
export async function resolveThreadUserId(
  supabase: TypedClient,
  params: { worldId: string; campaignId: string; callerId: string; requestedThreadUserId: string | null }
): Promise<string | null> {
  const isMj = await isWorldAdmin(supabase, { worldId: params.worldId, userId: params.callerId });
  if (!isMj) return params.callerId;
  if (!params.requestedThreadUserId) return null;
  const members = await listCampaignMembers(supabase, params.campaignId);
  const isPlayerMember = members.some((m) => m.user_id === params.requestedThreadUserId && m.role === "player");
  return isPlayerMember ? params.requestedThreadUserId : null;
}

/** Sommaire des fils pour le selecteur MJ (V2-M13) — un fil par joueur de la campagne, meme sans message (une conversation pas encore commencee reste accessible). */
export async function listChatThreadSummaries(
  supabase: TypedClient,
  params: { campaignId: string; mjUserId: string }
): Promise<ChatThreadSummary[]> {
  const members = await listCampaignMembers(supabase, params.campaignId);
  const playerIds = members.filter((m) => m.role === "player").map((m) => m.user_id);
  if (playerIds.length === 0) return [];

  const [names, lastMessages, lastReads] = await Promise.all([
    getDisplayNamesForUsers(supabase, playerIds),
    listLastMessagePerThread(supabase, { campaignId: params.campaignId, threadUserIds: playerIds }),
    listChatLastReadAtByThread(supabase, { campaignId: params.campaignId, userId: params.mjUserId }),
  ]);

  const summaries = await Promise.all(
    playerIds.map(async (playerId) => ({
      userId: playerId,
      displayName: names.get(playerId) ?? "?",
      lastMessage: lastMessages.get(playerId) ?? null,
      unreadCount: await countUnreadInThread(supabase, {
        campaignId: params.campaignId,
        threadUserId: playerId,
        readerId: params.mjUserId,
        sinceExclusive: lastReads.get(playerId) ?? null,
      }),
    }))
  );

  // Fils les plus recemment actifs en tete (retour utilisateur implicite,
  // meme convention que l'historique de jets) — jamais l'ordre arbitraire
  // de `listCampaignMembers`.
  summaries.sort((a, b) => {
    const at = a.lastMessage?.created_at ?? "";
    const bt = b.lastMessage?.created_at ?? "";
    return bt.localeCompare(at);
  });
  return summaries;
}
