import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";

type TypedClient = SupabaseClient<Database>;

export interface RulesetRow {
  id: string;
  name: string;
  parent_ruleset_id: string | null;
  is_official_base: boolean;
}

export async function getRulesetById(supabase: TypedClient, id: string): Promise<RulesetRow | null> {
  const { data, error } = await supabase
    .from("rulesets")
    .select("id, name, parent_ruleset_id, is_official_base")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export interface RulesetEntryRow {
  id: string;
  ruleset_id: string;
  entry_key: string;
  entry_type: string;
  source_attribution: string | null;
  source_raw: Json;
}

/**
 * Une regle par cle, dans UN ruleset precis — aucune remontee de chaine de
 * parente ici (c'est la resolution de surcharge de specs/regles-blocs.md
 * §8, V1-A4, pas ce ticket). Le service appelant decide s'il rappelle
 * cette fonction sur le ruleset parent.
 */
export async function getRulesetEntryByKey(
  supabase: TypedClient,
  rulesetId: string,
  entryKey: string
): Promise<RulesetEntryRow | null> {
  const { data, error } = await supabase
    .from("ruleset_entries")
    .select("id, ruleset_id, entry_key, entry_type, source_attribution, source_raw")
    .eq("ruleset_id", rulesetId)
    .eq("entry_key", entryKey)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export interface RulesetEntryBlockRow {
  id: string;
  entry_id: string;
  block_type: string;
  schema_version: number;
  display: Json;
  data: Json;
  display_order: number;
}

export async function listBlocksForRulesetEntry(
  supabase: TypedClient,
  entryId: string
): Promise<RulesetEntryBlockRow[]> {
  const { data, error } = await supabase
    .from("ruleset_entry_blocks")
    .select("id, entry_id, block_type, schema_version, display, data, display_order")
    .eq("entry_id", entryId)
    .order("display_order");
  if (error) throw new Error(error.message);
  return data;
}
