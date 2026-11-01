import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import type { GameDate } from "@/src/core/calendar/types";
import { parseJournalStatus, type JournalStatus } from "@/src/core/sessionJournal/devoir";

type TypedClient = SupabaseClient<Database>;

export interface SessionJournalEntryRow {
  id: string;
  campaign_id: string;
  ingame_date: GameDate;
  assigned_to: string;
  status: JournalStatus;
  entity_id: string | null;
  created_by: string;
  created_at: string;
  written_at: string | null;
  validated_at: string | null;
}

const COLUMNS = "id, campaign_id, ingame_date, assigned_to, status, entity_id, created_by, created_at, written_at, validated_at";

/** L'état est un `text` contraint en base : `parseJournalStatus` refuse une valeur inconnue plutôt que de la deviner. */
function toRow(data: { status: string } & Record<string, unknown>): SessionJournalEntryRow {
  return { ...(data as unknown as SessionJournalEntryRow), status: parseJournalStatus(data.status) };
}

/** V3.1-150 : le devoir naît avec sa page (`entityId`), créée juste avant par le MJ. */
export async function insertAssignment(
  supabase: TypedClient,
  params: { campaignId: string; ingameDate: GameDate; assignedTo: string; createdBy: string; entityId: string }
): Promise<SessionJournalEntryRow> {
  const { data, error } = await supabase
    .from("session_journal_entries")
    .insert({
      campaign_id: params.campaignId,
      ingame_date: params.ingameDate as unknown as Json,
      assigned_to: params.assignedTo,
      created_by: params.createdBy,
      entity_id: params.entityId,
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

/** Le devoir qui porte cette page (au plus un : la page naît avec lui). */
export async function getAssignmentByEntityId(supabase: TypedClient, entityId: string): Promise<SessionJournalEntryRow | null> {
  const { data, error } = await supabase.from("session_journal_entries").select(COLUMNS).eq("entity_id", entityId).limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toRow(data) : null;
}

/** Efface un devoir et rend la ligne effacée — `null` si rien ne l'a été (déjà effacé, ou refusé par la RLS) : V3.1-43 ne journalise qu'un vrai geste. */
export async function deleteAssignment(supabase: TypedClient, id: string): Promise<SessionJournalEntryRow | null> {
  const { data, error } = await supabase.from("session_journal_entries").delete().eq("id", id).select(COLUMNS);
  if (error) throw new Error(error.message);
  return data.length > 0 ? toRow(data[0]) : null;
}

/**
 * « Devoir fait » (V3.1-150) : `submit_journal_assignment`, la seule écriture
 * de l'autrice sur son devoir. `false` quand la base refuse (pas le sien,
 * déjà rendu, sans page).
 */
export async function submitAssignment(supabase: TypedClient, id: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("submit_journal_assignment", { p_assignment_id: id });
  if (error) throw new Error(error.message);
  return data === true;
}

/** Le MJ valide un devoir rendu ; `null` si aucune ligne `written` ne correspond (déjà validé, ou refusé par la RLS). */
export async function markValidated(supabase: TypedClient, id: string): Promise<SessionJournalEntryRow | null> {
  const { data, error } = await supabase
    .from("session_journal_entries")
    .update({ status: "validated", validated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "written")
    .select(COLUMNS);
  if (error) throw new Error(error.message);
  return data.length > 0 ? toRow(data[0]) : null;
}

/** Un devoir avec le nom et le slug de son entrée (V3.1-43 : registre du MJ) ; `null` si la RLS cache l'entrée. */
export interface SessionJournalAssignmentView extends SessionJournalEntryRow {
  entity_name: string | null;
  entity_slug: string | null;
}

export async function listAssignmentsForCampaign(supabase: TypedClient, campaignId: string): Promise<SessionJournalAssignmentView[]> {
  const { data, error } = await supabase
    .from("session_journal_entries")
    .select(`${COLUMNS}, entities(name, slug)`)
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data.map(({ entities, ...row }) => ({ ...toRow(row), entity_name: entities?.name ?? null, entity_slug: entities?.slug ?? null }));
}

/** Les devoirs pas encore validés d'un compte dans une campagne, avec leur page ; le plus récent d'abord. */
export async function listOpenAssignmentsForUser(supabase: TypedClient, params: { campaignId: string; userId: string }): Promise<SessionJournalAssignmentView[]> {
  const { data, error } = await supabase
    .from("session_journal_entries")
    .select(`${COLUMNS}, entities(name, slug)`)
    .eq("campaign_id", params.campaignId)
    .eq("assigned_to", params.userId)
    .in("status", ["pending", "written"])
    .not("entity_id", "is", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data.map(({ entities, ...row }) => ({ ...toRow(row), entity_name: entities?.name ?? null, entity_slug: entities?.slug ?? null }));
}

/**
 * Les pages du Livre dont le devoir n'est pas encore rendu (V3.1-150) : un
 * brouillon, que seuls son autrice et le MJ voient. Lu par le filtre de
 * visibilité des fiches côté joueur.
 */
export async function listUnpublishedJournalEntityIds(supabase: TypedClient, worldId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("session_journal_entries")
    .select("entity_id, campaigns!inner(world_id)")
    .eq("campaigns.world_id", worldId)
    .eq("status", "pending")
    .not("entity_id", "is", null);
  if (error) throw new Error(error.message);
  return data.flatMap((row) => (row.entity_id ? [row.entity_id] : []));
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
    // V3.1-150 : rendu, validé ou non — un brouillon n'est jamais dans le Livre.
    .in("status", ["written", "validated"])
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
