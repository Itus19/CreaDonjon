import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";

type TypedClient = SupabaseClient<Database>;

export interface SaveRequestRow {
  id: string;
  campaign_id: string;
  combat_id: string | null;
  origin_roll_id: string | null;
  author_user_id: string;
  target_kind: string;
  target_id: string;
  target_entity_id: string | null;
  target_user_id: string | null;
  label: string;
  ability: string;
  dc: number;
  effect: Json;
  status: string;
  natural: number | null;
  total: number | null;
  answered_by: string | null;
  created_at: string;
  answered_at: string | null;
}

const SAVE_REQUEST_COLUMNS =
  "id, campaign_id, combat_id, origin_roll_id, author_user_id, target_kind, target_id, target_entity_id, target_user_id, label, ability, dc, effect, status, natural, total, answered_by, created_at, answered_at";

/** V3.1-111 (ADR 0044) : la demande. `author_user_id` est posé par la base (`auth.uid()`), la RLS réserve la création au MJ. */
export async function insertSaveRequest(
  supabase: TypedClient,
  params: {
    campaignId: string;
    combatId: string | null;
    originRollId: string | null;
    targetKind: "entity" | "participant";
    targetId: string;
    targetEntityId: string | null;
    targetUserId: string | null;
    label: string;
    ability: string;
    dc: number;
    effect: Json;
  }
): Promise<SaveRequestRow> {
  const { data, error } = await supabase
    .from("save_requests")
    .insert({
      campaign_id: params.campaignId,
      combat_id: params.combatId,
      origin_roll_id: params.originRollId,
      target_kind: params.targetKind,
      target_id: params.targetId,
      target_entity_id: params.targetEntityId,
      target_user_id: params.targetUserId,
      label: params.label,
      ability: params.ability,
      dc: params.dc,
      effect: params.effect,
    })
    .select(SAVE_REQUEST_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/** Lisible de l'auteur, du joueur de la cible et du MJ (RLS) : `null` pour tout autre compte. */
export async function getSaveRequestById(supabase: TypedClient, id: string): Promise<SaveRequestRow | null> {
  const { data, error } = await supabase.from("save_requests").select(SAVE_REQUEST_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** Les demandes en attente qu'un compte voit dans une campagne (RLS : les siennes, ou toutes pour le MJ). */
export async function listPendingSaveRequests(supabase: TypedClient, campaignId: string): Promise<SaveRequestRow[]> {
  const { data, error } = await supabase
    .from("save_requests")
    .select(SAVE_REQUEST_COLUMNS)
    .eq("campaign_id", campaignId)
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data;
}

/** `public.answer_save_request` : la ligne répondue, ou `null` si refusé (mauvais compte, déjà répondue, annulée). */
export async function answerSaveRequestRow(
  supabase: TypedClient,
  params: { requestId: string; natural: number | null; total: number }
): Promise<SaveRequestRow | null> {
  const { data, error } = await supabase.rpc("answer_save_request", { p_request: params.requestId, p_natural: params.natural, p_total: params.total });
  if (error) throw new Error(error.message);
  return (data as unknown as SaveRequestRow | null) ?? null;
}

/** `public.set_own_participant_vitals` : avant/après, ou `null` si ce n'est pas le PJ de l'appelant. */
export async function setOwnParticipantVitals(
  supabase: TypedClient,
  params: { participantId: string; hpCurrent: number; tempHp: number; conditions: string[] }
): Promise<{ before: Json; after: Json } | null> {
  const { data, error } = await supabase.rpc("set_own_participant_vitals", {
    p_participant: params.participantId,
    p_hp_current: params.hpCurrent,
    p_temp_hp: params.tempHp,
    p_conditions: params.conditions as unknown as Json,
  });
  if (error) throw new Error(error.message);
  return (data as unknown as { before: Json; after: Json } | null) ?? null;
}
