import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";

type TypedClient = SupabaseClient<Database>;

export interface WorldForExport {
  name: string;
  calendar: Json;
  defaultRulesetId: string | null;
}

export async function getWorldForExport(supabase: TypedClient, worldId: string): Promise<WorldForExport | null> {
  const { data, error } = await supabase
    .from("worlds")
    .select("name, calendar, default_ruleset_id")
    .eq("id", worldId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return { name: data.name, calendar: data.calendar, defaultRulesetId: data.default_ruleset_id };
}

/** Mode de l'unique campagne du monde (un monde = une campagne, migration 20260826100001) — `null` pour un monde plus ancien jamais complete. */
export async function getSingleCampaignMode(supabase: TypedClient, worldId: string): Promise<"campaign" | "solo" | null> {
  const { data, error } = await supabase.from("campaigns").select("mode").eq("world_id", worldId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.mode as "campaign" | "solo" | undefined) ?? null;
}

export interface ExportRulesetInfo {
  id: string;
  name: string;
  baseSystem: string;
  isOfficialBase: boolean;
  contentOrigin: string;
}

export async function getRulesetInfoForExport(supabase: TypedClient, rulesetId: string): Promise<ExportRulesetInfo | null> {
  const { data, error } = await supabase
    .from("rulesets")
    .select("id, name, base_system, is_official_base, content_origin")
    .eq("id", rulesetId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return { id: data.id, name: data.name, baseSystem: data.base_system, isOfficialBase: data.is_official_base, contentOrigin: data.content_origin };
}

export interface RulesetOverrideForExport {
  entry_key: string;
  block_type: string | null;
  action: string;
  payload: Json;
  patch: Json;
  note: string | null;
}

/**
 * TOUTES les surcharges d'un ruleset (contrairement a
 * `listEntryLevelOverridesForRuleset`/`listOverridesForRuleset`, deja dans
 * `rules.ts`, qui filtrent chacune sur un sous-ensemble precis pour leur
 * propre usage) — un export doit reconstruire la variante en entier, fiches
 * maison (`add_entry`) comme correctifs sur une fiche officielle
 * (`patch_block` sur `fireball`, ex. seed-dev.ts).
 */
export async function listAllOverridesForRuleset(supabase: TypedClient, rulesetId: string): Promise<RulesetOverrideForExport[]> {
  const { data, error } = await supabase
    .from("ruleset_overrides")
    .select("entry_key, block_type, action, payload, patch, note")
    .eq("ruleset_id", rulesetId)
    .order("created_at");
  if (error) throw new Error(error.message);
  return data;
}

export interface EntityForExport {
  id: string;
  entity_kind: string;
  slug: string;
  name: string;
  aliases: string[];
  current_mechanical_revision_id: string | null;
}

export async function listEntitiesForWorld(supabase: TypedClient, worldId: string): Promise<EntityForExport[]> {
  const { data, error } = await supabase
    .from("entities")
    .select("id, entity_kind, slug, name, aliases, current_mechanical_revision_id")
    .eq("world_id", worldId)
    .is("deleted_at", null);
  if (error) throw new Error(error.message);
  return data;
}

export interface BlockForExport {
  entity_id: string;
  block_type: string;
  display: Json;
  data: Json;
  display_order: number;
  visibility_level: string;
}

export async function listBlocksForEntities(supabase: TypedClient, entityIds: string[]): Promise<BlockForExport[]> {
  if (entityIds.length === 0) return [];
  const { data, error } = await supabase
    .from("blocks")
    .select("entity_id, block_type, display, data, display_order, visibility_level")
    .in("entity_id", entityIds);
  if (error) throw new Error(error.message);
  return data;
}

export interface RelationForExport {
  source_entity_id: string;
  target_entity_id: string;
  relation_type: string;
  visibility_level: string;
}

export async function listRelationsForWorld(supabase: TypedClient, worldId: string): Promise<RelationForExport[]> {
  const { data, error } = await supabase
    .from("relations")
    .select("source_entity_id, target_entity_id, relation_type, visibility_level")
    .eq("world_id", worldId);
  if (error) throw new Error(error.message);
  return data;
}

export interface MechanicalRevisionForExport {
  id: string;
  entity_id: string;
  revision_number: number;
  mechanical_data: Json;
  change_note: string | null;
}

export async function listMechanicalRevisionsForEntities(
  supabase: TypedClient,
  entityIds: string[]
): Promise<MechanicalRevisionForExport[]> {
  if (entityIds.length === 0) return [];
  const { data, error } = await supabase
    .from("entity_mechanical_revisions")
    .select("id, entity_id, revision_number, mechanical_data, change_note")
    .in("entity_id", entityIds);
  if (error) throw new Error(error.message);
  return data;
}

// --- Ecriture (import) ---

export async function insertImportedWorld(
  supabase: TypedClient,
  params: { ownerId: string; name: string; slug: string; calendar: Json }
): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from("worlds")
    .insert({ owner_id: params.ownerId, name: params.name, slug: params.slug, calendar: params.calendar })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export interface ImportedBlockInput {
  entityId: string;
  blockType: string;
  display: Json;
  data: Json;
  displayOrder: number;
  visibilityLevel: string;
  createdBy: string;
}

export async function insertImportedBlocks(supabase: TypedClient, blocks: ImportedBlockInput[]): Promise<void> {
  if (blocks.length === 0) return;
  const { error } = await supabase.from("blocks").insert(
    blocks.map((b) => ({
      entity_id: b.entityId,
      block_type: b.blockType,
      display: b.display,
      data: b.data,
      display_order: b.displayOrder,
      visibility_level: b.visibilityLevel,
      created_by: b.createdBy,
    }))
  );
  if (error) throw new Error(error.message);
}

export interface ImportedRelationInput {
  worldId: string;
  sourceEntityId: string;
  targetEntityId: string;
  relationType: string;
  visibilityLevel: string;
  createdBy: string;
}

export async function insertImportedRelations(supabase: TypedClient, relations: ImportedRelationInput[]): Promise<void> {
  if (relations.length === 0) return;
  const { error } = await supabase.from("relations").insert(
    relations.map((r) => ({
      world_id: r.worldId,
      source_entity_id: r.sourceEntityId,
      target_entity_id: r.targetEntityId,
      relation_type: r.relationType,
      visibility_level: r.visibilityLevel,
      created_by: r.createdBy,
    }))
  );
  if (error) throw new Error(error.message);
}

export interface ImportedMechanicalRevisionInput {
  entityId: string;
  revisionNumber: number;
  mechanicalData: Json;
  changeNote: string | null;
  createdBy: string;
}

/** Retourne les lignes creees (avec leur nouvel id) pour reassigner ensuite `entities.current_mechanical_revision_id` — jamais par ordre de tableau, par la paire `(entity_id, revision_number)`, unique en base. */
export async function insertImportedMechanicalRevisions(
  supabase: TypedClient,
  revisions: ImportedMechanicalRevisionInput[]
): Promise<{ id: string; entity_id: string; revision_number: number }[]> {
  if (revisions.length === 0) return [];
  const { data, error } = await supabase
    .from("entity_mechanical_revisions")
    .insert(
      revisions.map((r) => ({
        entity_id: r.entityId,
        revision_number: r.revisionNumber,
        mechanical_data: r.mechanicalData,
        change_note: r.changeNote,
        created_by: r.createdBy,
      }))
    )
    .select("id, entity_id, revision_number");
  if (error) throw new Error(error.message);
  return data;
}

export async function setEntityCurrentRevision(supabase: TypedClient, entityId: string, revisionId: string): Promise<void> {
  const { error } = await supabase.from("entities").update({ current_mechanical_revision_id: revisionId }).eq("id", entityId);
  if (error) throw new Error(error.message);
}
