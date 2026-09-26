import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";

type TypedClient = SupabaseClient<Database>;

/** SCHEMA.md §16.2 — l'IA n'ecrit jamais directement en base, toute mutation passe par cette table. */
export type AiProposalKind =
  | "create_entity"
  | "update_entity"
  | "create_block"
  | "update_block"
  | "create_relation"
  | "set_discovery"
  | "update_mechanical";
export type AiProposalStatus = "pending" | "applied" | "rejected" | "failed";

export interface AiProposalRow {
  id: string;
  worldId: string;
  campaignId: string | null;
  sessionEventId: string | null;
  kind: AiProposalKind;
  targetEntityId: string | null;
  payload: Json;
  status: AiProposalStatus;
  validationErrors: Json | null;
  autoApplied: boolean;
  reviewedBy: string | null;
  appliedAt: string | null;
  createdAt: string;
}

const COLUMNS =
  "id, world_id, campaign_id, session_event_id, kind, target_entity_id, payload, status, validation_errors, auto_applied, reviewed_by, applied_at, created_at";

interface AiProposalRawRow {
  id: string;
  world_id: string;
  campaign_id: string | null;
  session_event_id: string | null;
  kind: string;
  target_entity_id: string | null;
  payload: Json;
  status: string;
  validation_errors: Json | null;
  auto_applied: boolean;
  reviewed_by: string | null;
  applied_at: string | null;
  created_at: string;
}

function toRow(r: AiProposalRawRow): AiProposalRow {
  return {
    id: r.id,
    worldId: r.world_id,
    campaignId: r.campaign_id,
    sessionEventId: r.session_event_id,
    kind: r.kind as AiProposalKind,
    targetEntityId: r.target_entity_id,
    payload: r.payload,
    status: r.status as AiProposalStatus,
    validationErrors: r.validation_errors,
    autoApplied: r.auto_applied,
    reviewedBy: r.reviewed_by,
    appliedAt: r.applied_at,
    createdAt: r.created_at,
  };
}

export async function insertAiProposal(
  supabase: TypedClient,
  params: {
    worldId: string;
    campaignId: string | null;
    /** V3-C3 — le `session_event` qui a fait naître cette proposition, condition de « annuler ce tour » (V3-F2, pas encore fait) : sans lui, une mutation `auto_applied` ne serait pas retrouvable par son tour. */
    sessionEventId?: string | null;
    kind: AiProposalKind;
    targetEntityId: string | null;
    payload: Json;
    status: AiProposalStatus;
    validationErrors?: Json | null;
    /** V3-C3 — vrai pour une mutation décidée par le CODE (générateur, ancrage), jamais par le modèle : `false` par défaut, comme la colonne (SCHEMA.md §16.2). */
    autoApplied?: boolean;
    reviewedBy?: string | null;
    appliedAt?: string | null;
  }
): Promise<AiProposalRow> {
  const { data, error } = await supabase
    .from("ai_proposals")
    .insert({
      world_id: params.worldId,
      campaign_id: params.campaignId,
      session_event_id: params.sessionEventId ?? null,
      kind: params.kind,
      target_entity_id: params.targetEntityId,
      payload: params.payload,
      status: params.status,
      validation_errors: params.validationErrors ?? null,
      auto_applied: params.autoApplied ?? false,
      reviewed_by: params.reviewedBy ?? null,
      applied_at: params.appliedAt ?? null,
    })
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return toRow(data);
}

export async function getAiProposalById(supabase: TypedClient, id: string): Promise<AiProposalRow | null> {
  const { data, error } = await supabase.from("ai_proposals").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toRow(data) : null;
}

/** File de relecture (V1-F3) : propositions en attente pour l'entite ouverte, plus recentes en premier. */
export async function listPendingAiProposalsForEntity(supabase: TypedClient, entityId: string): Promise<AiProposalRow[]> {
  const { data, error } = await supabase
    .from("ai_proposals")
    .select(COLUMNS)
    .eq("target_entity_id", entityId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(toRow);
}

export async function updateAiProposalStatus(
  supabase: TypedClient,
  params: { id: string; status: AiProposalStatus; reviewedBy: string; appliedAt?: string | null }
): Promise<AiProposalRow | null> {
  const { data, error } = await supabase
    .from("ai_proposals")
    .update({ status: params.status, reviewed_by: params.reviewedBy, applied_at: params.appliedAt ?? null })
    .eq("id", params.id)
    .select(COLUMNS)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toRow(data) : null;
}
