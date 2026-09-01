import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";

type TypedClient = SupabaseClient<Database>;

export interface ChatMessageRow {
  id: string;
  campaign_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

const CHAT_MESSAGE_COLUMNS = "id, campaign_id, sender_id, body, created_at";

/** Salon de campagne (V2-M12) — RLS `campaign_chat_messages_select` filtre deja aux membres du monde, jamais un second filtre ici. */
export async function listChatMessagesForCampaign(
  supabase: TypedClient,
  params: { campaignId: string; limit: number }
): Promise<ChatMessageRow[]> {
  const { data, error } = await supabase
    .from("campaign_chat_messages")
    .select(CHAT_MESSAGE_COLUMNS)
    .eq("campaign_id", params.campaignId)
    .order("created_at", { ascending: false })
    .limit(params.limit);
  if (error) throw new Error(error.message);
  return data;
}

export async function insertChatMessage(
  supabase: TypedClient,
  params: { campaignId: string; senderId: string; body: string }
): Promise<ChatMessageRow> {
  const { data, error } = await supabase
    .from("campaign_chat_messages")
    .insert({ campaign_id: params.campaignId, sender_id: params.senderId, body: params.body })
    .select(CHAT_MESSAGE_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/** Compte les messages recus (jamais les siens) depuis la derniere lecture — `lastReadAt` nul si l'utilisateur n'a jamais ouvert le salon (tout compte). */
export async function countUnreadChatMessages(
  supabase: TypedClient,
  params: { campaignId: string; userId: string; sinceExclusive: string | null }
): Promise<number> {
  let query = supabase
    .from("campaign_chat_messages")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", params.campaignId)
    .neq("sender_id", params.userId);
  if (params.sinceExclusive) query = query.gt("created_at", params.sinceExclusive);
  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function getChatLastReadAt(
  supabase: TypedClient,
  params: { campaignId: string; userId: string }
): Promise<string | null> {
  const { data, error } = await supabase
    .from("campaign_chat_reads")
    .select("last_read_at")
    .eq("campaign_id", params.campaignId)
    .eq("user_id", params.userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.last_read_at ?? null;
}

/** Marque le salon lu maintenant (V2-M12, pastille) — un upsert plutot qu'un insert : la ligne (campagne, utilisateur) existe deja des la premiere ouverture. */
export async function markChatRead(supabase: TypedClient, params: { campaignId: string; userId: string }): Promise<void> {
  const { error } = await supabase
    .from("campaign_chat_reads")
    .upsert(
      { campaign_id: params.campaignId, user_id: params.userId, last_read_at: new Date().toISOString() },
      { onConflict: "campaign_id,user_id" }
    );
  if (error) throw new Error(error.message);
}
