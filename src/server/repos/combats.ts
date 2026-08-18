import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";

type TypedClient = SupabaseClient<Database>;

export interface CombatRow {
  id: string;
  campaign_id: string;
  session_id: string | null;
  name: string | null;
  round: number;
  turn_index: number;
  status: string;
  created_at: string;
  updated_at: string;
}

const COMBAT_COLUMNS = "id, campaign_id, session_id, name, round, turn_index, status, created_at, updated_at";

export async function insertCombat(
  supabase: TypedClient,
  params: { campaignId: string; sessionId: string | null; name: string | null }
): Promise<CombatRow> {
  const { data, error } = await supabase
    .from("combats")
    .insert({ campaign_id: params.campaignId, session_id: params.sessionId, name: params.name })
    .select(COMBAT_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getCombatById(supabase: TypedClient, id: string): Promise<CombatRow | null> {
  const { data, error } = await supabase.from("combats").select(COMBAT_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** Le combat en cours (jamais termine) le plus recent d'une campagne — au plus un a la fois dans l'usage attendu, mais rien ne l'impose en base. */
export async function getActiveCombatForCampaign(supabase: TypedClient, campaignId: string): Promise<CombatRow | null> {
  const { data, error } = await supabase
    .from("combats")
    .select(COMBAT_COLUMNS)
    .eq("campaign_id", campaignId)
    .neq("status", "ended")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** "Mes combats" (V1-E4) — tous les combats d'une campagne, les plus recents d'abord. */
export async function listCombatsForCampaign(supabase: TypedClient, campaignId: string): Promise<CombatRow[]> {
  const { data, error } = await supabase
    .from("combats")
    .select(COMBAT_COLUMNS)
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function updateCombat(
  supabase: TypedClient,
  id: string,
  patch: { round?: number; turnIndex?: number; status?: string }
): Promise<CombatRow> {
  const update: Database["public"]["Tables"]["combats"]["Update"] = {};
  if (patch.round !== undefined) update.round = patch.round;
  if (patch.turnIndex !== undefined) update.turn_index = patch.turnIndex;
  if (patch.status !== undefined) update.status = patch.status;
  const { data, error } = await supabase.from("combats").update(update).eq("id", id).select(COMBAT_COLUMNS).single();
  if (error) throw new Error(error.message);
  return data;
}

export interface CombatParticipantRow {
  id: string;
  combat_id: string;
  source_kind: string;
  entity_id: string | null;
  rule_key: string | null;
  label: string;
  initiative: number | null;
  ac: number | null;
  hp_max: number | null;
  hp_current: number | null;
  temp_hp: number;
  conditions: Json;
  concentration: Json;
  is_ally: boolean;
  display_order: number;
  created_at: string;
}

const PARTICIPANT_COLUMNS =
  "id, combat_id, source_kind, entity_id, rule_key, label, initiative, ac, hp_max, hp_current, temp_hp, conditions, concentration, is_ally, display_order, created_at";

export async function listCombatParticipants(supabase: TypedClient, combatId: string): Promise<CombatParticipantRow[]> {
  const { data, error } = await supabase
    .from("combat_participants")
    .select(PARTICIPANT_COLUMNS)
    .eq("combat_id", combatId)
    .order("display_order");
  if (error) throw new Error(error.message);
  return data;
}

export async function getCombatParticipantById(supabase: TypedClient, id: string): Promise<CombatParticipantRow | null> {
  const { data, error } = await supabase.from("combat_participants").select(PARTICIPANT_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export interface InsertCombatParticipantParams {
  combatId: string;
  sourceKind: "entity" | "statblock" | "custom";
  entityId: string | null;
  ruleKey: string | null;
  label: string;
  ac: number | null;
  hpMax: number | null;
  hpCurrent: number | null;
  isAlly: boolean;
  displayOrder: number;
}

export async function insertCombatParticipant(
  supabase: TypedClient,
  params: InsertCombatParticipantParams
): Promise<CombatParticipantRow> {
  const { data, error } = await supabase
    .from("combat_participants")
    .insert({
      combat_id: params.combatId,
      source_kind: params.sourceKind,
      entity_id: params.entityId,
      rule_key: params.ruleKey,
      label: params.label,
      ac: params.ac,
      hp_max: params.hpMax,
      hp_current: params.hpCurrent,
      is_ally: params.isAlly,
      display_order: params.displayOrder,
    })
    .select(PARTICIPANT_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export interface CombatParticipantPatch {
  initiative?: number | null;
  hpCurrent?: number | null;
  tempHp?: number;
  conditions?: Json;
  concentration?: Json;
}

export async function updateCombatParticipant(
  supabase: TypedClient,
  id: string,
  patch: CombatParticipantPatch
): Promise<CombatParticipantRow> {
  const update: Database["public"]["Tables"]["combat_participants"]["Update"] = {};
  if (patch.initiative !== undefined) update.initiative = patch.initiative;
  if (patch.hpCurrent !== undefined) update.hp_current = patch.hpCurrent;
  if (patch.tempHp !== undefined) update.temp_hp = patch.tempHp;
  if (patch.conditions !== undefined) update.conditions = patch.conditions;
  if (patch.concentration !== undefined) update.concentration = patch.concentration;
  const { data, error } = await supabase
    .from("combat_participants")
    .update(update)
    .eq("id", id)
    .select(PARTICIPANT_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteCombatParticipant(supabase: TypedClient, id: string): Promise<void> {
  const { error } = await supabase.from("combat_participants").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
