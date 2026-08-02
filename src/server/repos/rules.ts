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

export interface RulesetEntrySummaryRow {
  id: string;
  entry_key: string;
  entry_type: string;
  source_raw: Json;
}

const LIST_PAGE_SIZE = 1000;

/**
 * Pour la barre laterale de consultation (onglet Regles) : toutes les
 * entrees d'UN ruleset, aucune remontee de chaine ici (voir le service
 * appelant). Pagine explicitement : PostgREST plafonne une reponse a 1000
 * lignes par defaut (supabase/config.toml, max_rows) — un simple
 * `.select()` sur les 1790 entrees du SRD 5.1 tronquerait silencieusement
 * la liste, sans erreur, juste des regles absentes au hasard de l'ordre
 * renvoye (constate en verifiant dans le navigateur : Fireball manquait).
 */
export async function listRulesetEntries(
  supabase: TypedClient,
  rulesetId: string
): Promise<RulesetEntrySummaryRow[]> {
  const all: RulesetEntrySummaryRow[] = [];
  for (let from = 0; ; from += LIST_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("ruleset_entries")
      .select("id, entry_key, entry_type, source_raw")
      .eq("ruleset_id", rulesetId)
      .range(from, from + LIST_PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    all.push(...data);
    if (data.length < LIST_PAGE_SIZE) break;
  }
  return all;
}

export interface EntryTranslationRow {
  entry_id: string;
  locale: string;
  name: string;
  source: string;
}

/** Traduction d'une seule entree (fiche de regle) : `null` si aucune traduction n'existe pour cette locale — l'appelant retombe sur le nom source (anglais). */
export async function getEntryTranslation(
  supabase: TypedClient,
  entryId: string,
  locale: string
): Promise<EntryTranslationRow | null> {
  const { data, error } = await supabase
    .from("ruleset_entry_translations")
    .select("entry_id, locale, name, source")
    .eq("entry_id", entryId)
    .eq("locale", locale)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

const TRANSLATION_BATCH_SIZE = 500;

/** Toutes les traductions disponibles pour un ensemble d'entrees (barre laterale) : pagine l'IN, meme raison que listRulesetEntries. */
export async function listTranslationsForEntries(
  supabase: TypedClient,
  entryIds: string[],
  locale: string
): Promise<EntryTranslationRow[]> {
  const all: EntryTranslationRow[] = [];
  for (let i = 0; i < entryIds.length; i += TRANSLATION_BATCH_SIZE) {
    const batch = entryIds.slice(i, i + TRANSLATION_BATCH_SIZE);
    const { data, error } = await supabase
      .from("ruleset_entry_translations")
      .select("entry_id, locale, name, source")
      .eq("locale", locale)
      .in("entry_id", batch);
    if (error) throw new Error(error.message);
    all.push(...data);
  }
  return all;
}

/** Ecriture en lot (script de traduction) : une ligne par (entry_id, locale), jamais deux appels distincts pour la meme cle (primary key composite, upsert). */
export async function upsertEntryTranslations(
  supabase: TypedClient,
  rows: { entryId: string; locale: string; name: string; source: string }[]
): Promise<void> {
  const { error } = await supabase.from("ruleset_entry_translations").upsert(
    rows.map((r) => ({ entry_id: r.entryId, locale: r.locale, name: r.name, source: r.source })),
    { onConflict: "entry_id,locale" }
  );
  if (error) throw new Error(error.message);
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
