import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";

type TypedClient = SupabaseClient<Database>;

export interface ChatMessageRow {
  id: string;
  campaign_id: string;
  sender_id: string;
  /** V3.1-22 (ADR 0038) : `null` = le salon de table ; sinon le joueur du fil privé. */
  thread_user_id: string | null;
  body: string;
  created_at: string;
}

const CHAT_MESSAGE_COLUMNS = "id, campaign_id, sender_id, thread_user_id, body, created_at";

/**
 * Un fil (V2-M13) ou le salon (V3.1-22, `threadUserId: null`) — RLS
 * `campaign_chat_messages_select` filtre deja : le salon aux membres de la
 * campagne, un fil prive a son joueur et au MJ ; jamais un second filtre ici.
 */
export async function listChatMessagesForThread(
  supabase: TypedClient,
  params: { campaignId: string; threadUserId: string | null; limit: number }
): Promise<ChatMessageRow[]> {
  const base = supabase.from("campaign_chat_messages").select(CHAT_MESSAGE_COLUMNS).eq("campaign_id", params.campaignId);
  const { data, error } = await (params.threadUserId === null ? base.is("thread_user_id", null) : base.eq("thread_user_id", params.threadUserId))
    .order("created_at", { ascending: false })
    .limit(params.limit);
  if (error) throw new Error(error.message);
  return data;
}

/** Dernier message de chaque fil (V2-M13, sommaire MJ des fils) — une seule requete plutot qu'une par joueur, le nombre de fils d'une campagne reste petit. */
export async function listLastMessagePerThread(
  supabase: TypedClient,
  params: { campaignId: string; threadUserIds: string[] }
): Promise<Map<string, ChatMessageRow>> {
  if (params.threadUserIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from("campaign_chat_messages")
    .select(CHAT_MESSAGE_COLUMNS)
    .eq("campaign_id", params.campaignId)
    .in("thread_user_id", params.threadUserIds)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const result = new Map<string, ChatMessageRow>();
  for (const row of data) {
    if (row.thread_user_id !== null && !result.has(row.thread_user_id)) result.set(row.thread_user_id, row);
  }
  return result;
}

export async function insertChatMessage(
  supabase: TypedClient,
  params: { campaignId: string; senderId: string; threadUserId: string | null; body: string }
): Promise<ChatMessageRow> {
  const { data, error } = await supabase
    .from("campaign_chat_messages")
    .insert({
      campaign_id: params.campaignId,
      sender_id: params.senderId,
      thread_user_id: params.threadUserId,
      body: params.body,
    })
    .select(CHAT_MESSAGE_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/** Compte les messages recus (jamais les siens) dans CE fil depuis la derniere lecture — `lastReadAt` nul si jamais ouvert (tout compte). */
export async function countUnreadInThread(
  supabase: TypedClient,
  params: { campaignId: string; threadUserId: string | null; readerId: string; sinceExclusive: string | null }
): Promise<number> {
  const base = supabase.from("campaign_chat_messages").select("id", { count: "exact", head: true }).eq("campaign_id", params.campaignId);
  let query = (params.threadUserId === null ? base.is("thread_user_id", null) : base.eq("thread_user_id", params.threadUserId)).neq("sender_id", params.readerId);
  if (params.sinceExclusive) query = query.gt("created_at", params.sinceExclusive);
  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** Total tous fils confondus, pour la pastille globale (badge MJ dans la barre laterale, pastille joueur unique puisqu'il n'a qu'un fil). */
export async function countUnreadAcrossThreads(
  supabase: TypedClient,
  params: { campaignId: string; readerId: string; threads: { threadUserId: string | null; sinceExclusive: string | null }[] }
): Promise<number> {
  const counts = await Promise.all(
    params.threads.map((t) => countUnreadInThread(supabase, { campaignId: params.campaignId, threadUserId: t.threadUserId, readerId: params.readerId, sinceExclusive: t.sinceExclusive }))
  );
  return counts.reduce((sum, n) => sum + n, 0);
}

export async function getChatLastReadAt(
  supabase: TypedClient,
  params: { campaignId: string; userId: string; threadUserId: string | null }
): Promise<string | null> {
  const base = supabase.from("campaign_chat_reads").select("last_read_at").eq("campaign_id", params.campaignId).eq("user_id", params.userId);
  const { data, error } = await (params.threadUserId === null ? base.is("thread_user_id", null) : base.eq("thread_user_id", params.threadUserId)).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.last_read_at ?? null;
}

/** Toutes les dates de derniere lecture d'un lecteur pour cette campagne (V2-M13, MJ : un fil par joueur) — une requete groupee plutot qu'une par fil. */
export async function listChatLastReadAtByThread(
  supabase: TypedClient,
  params: { campaignId: string; userId: string }
): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from("campaign_chat_reads")
    .select("thread_user_id, last_read_at")
    .eq("campaign_id", params.campaignId)
    .eq("user_id", params.userId);
  if (error) throw new Error(error.message);
  // Le salon (fil nul) se lit par `getChatLastReadAt` : ici, les fils prives seulement.
  return new Map(data.flatMap((r) => (r.thread_user_id === null ? [] : [[r.thread_user_id, r.last_read_at] as const])));
}

/** Marque un fil lu maintenant (V2-M13, pastille) — upsert : la ligne (campagne, lecteur, fil) existe deja des la premiere ouverture. */
export async function markChatRead(supabase: TypedClient, params: { campaignId: string; userId: string; threadUserId: string | null }): Promise<void> {
  const { error } = await supabase
    .from("campaign_chat_reads")
    .upsert(
      { campaign_id: params.campaignId, user_id: params.userId, thread_user_id: params.threadUserId, last_read_at: new Date().toISOString() },
      { onConflict: "campaign_id,user_id,thread_user_id" }
    );
  if (error) throw new Error(error.message);
}
