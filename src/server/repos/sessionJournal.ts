import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import type { GameDate } from "@/src/core/calendar/types";

type TypedClient = SupabaseClient<Database>;

export interface SessionJournalEntryRow {
  id: string;
  campaign_id: string;
  ingame_date: GameDate;
  assigned_to: string;
  status: string;
  entity_id: string | null;
  created_by: string;
  created_at: string;
  written_at: string | null;
}

const COLUMNS = "id, campaign_id, ingame_date, assigned_to, status, entity_id, created_by, created_at, written_at";

function toRow(data: unknown): SessionJournalEntryRow {
  return data as SessionJournalEntryRow;
}

export async function insertAssignment(
  supabase: TypedClient,
  params: { campaignId: string; ingameDate: GameDate; assignedTo: string; createdBy: string }
): Promise<SessionJournalEntryRow> {
  const { data, error } = await supabase
    .from("session_journal_entries")
    .insert({
      campaign_id: params.campaignId,
      ingame_date: params.ingameDate as unknown as Json,
      assigned_to: params.assignedTo,
      created_by: params.createdBy,
    })
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return toRow(data);
}

export async function getAssignmentById(supabase: TypedClient, id: string): Promise<SessionJournalEntryRow | null> {
  const { data, error } = await supabase.from("session_journal_entries").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toRow(data) : null;
}

export async function deleteAssignment(supabase: TypedClient, id: string): Promise<void> {
  const { error } = await supabase.from("session_journal_entries").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Marque un devoir redige — pose `entity_id`/`written_at` en une seule ecriture, jamais deux (concurrence). */
export async function markWritten(supabase: TypedClient, params: { id: string; entityId: string }): Promise<SessionJournalEntryRow> {
  const { data, error } = await supabase
    .from("session_journal_entries")
    .update({ status: "written", entity_id: params.entityId, written_at: new Date().toISOString() })
    .eq("id", params.id)
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return toRow(data);
}

export async function listAssignmentsForCampaign(supabase: TypedClient, campaignId: string): Promise<SessionJournalEntryRow[]> {
  const { data, error } = await supabase
    .from("session_journal_entries")
    .select(COLUMNS)
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data.map(toRow);
}

/** Devoirs en attente d'un compte, tous mondes/campagnes confondus ou une seule campagne selon l'appelant. */
export async function listPendingAssignmentsForUser(supabase: TypedClient, params: { campaignId: string; userId: string }): Promise<SessionJournalEntryRow[]> {
  const { data, error } = await supabase
    .from("session_journal_entries")
    .select(COLUMNS)
    .eq("campaign_id", params.campaignId)
    .eq("assigned_to", params.userId)
    .eq("status", "pending");
  if (error) throw new Error(error.message);
  return data.map(toRow);
}

export interface WrittenJournalEntry {
  id: string;
  entityId: string;
  name: string;
  slug: string;
  isPublic: boolean;
  writtenAt: string;
  ingameDate: GameDate;
}

/** Entrees redigees d'un monde, triees par date IRL de redaction decroissante (retour utilisateur) — jointure sur `entities` pour le titre/slug/`is_public`, jamais duplique dans cette table (regle absolue n°16 par analogie). L'appelant filtre par `isPublic` pour les surfaces anonymes (aperçu/partage). */
export async function listWrittenEntriesForWorld(supabase: TypedClient, worldId: string): Promise<WrittenJournalEntry[]> {
  const { data, error } = await supabase
    .from("session_journal_entries")
    .select("id, entity_id, written_at, ingame_date, campaigns!inner(world_id), entities(name, slug, is_public)")
    .eq("campaigns.world_id", worldId)
    .eq("status", "written")
    .order("written_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data
    .filter((row): row is typeof row & { entity_id: string; entities: { name: string; slug: string; is_public: boolean } } => row.entity_id !== null && row.entities !== null)
    .map((row) => ({
      id: row.id,
      entityId: row.entity_id,
      name: row.entities.name,
      slug: row.entities.slug,
      isPublic: row.entities.is_public,
      writtenAt: row.written_at as string,
      ingameDate: row.ingame_date as unknown as GameDate,
    }));
}

/**
 * Pose l'octroi d'edition de l'autrice sur l'entree qu'elle vient de creer
 * (V2.1-15, migration 20260915190000). RPC plutot qu'un `insert` direct :
 * `entity_grants_write` reste reservee au MJ, et cette fonction
 * `security definer` est la seule exception — etroite, elle ne sait poser
 * qu'une ligne pour l'appelante elle-meme, sur un devoir qui lui est
 * reellement assigne.
 *
 * `false` (plutot qu'une erreur) quand les conditions ne sont pas reunies :
 * l'appelant decide quoi en faire, et c'est `submitJournalEntry` qui sait
 * que cela doit interrompre la redaction.
 */
export async function claimJournalEntryGrant(
  supabase: TypedClient,
  params: { assignmentId: string; entityId: string }
): Promise<boolean> {
  const { data, error } = await supabase.rpc("claim_journal_entry_grant", {
    p_assignment_id: params.assignmentId,
    p_entity_id: params.entityId,
  });
  if (error) throw new Error(error.message);
  return data === true;
}
