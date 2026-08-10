import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";

type TypedClient = SupabaseClient<Database>;

export interface RulesetRow {
  id: string;
  name: string;
  parent_ruleset_id: string | null;
  is_official_base: boolean;
  base_system: string;
}

export async function getRulesetById(supabase: TypedClient, id: string): Promise<RulesetRow | null> {
  const { data, error } = await supabase
    .from("rulesets")
    .select("id, name, parent_ruleset_id, is_official_base, base_system")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export interface SelectableRulesetRow {
  id: string;
  name: string;
  is_official_base: boolean;
  base_system: string;
  version: number;
  published_at: string | null;
}

/**
 * Rulesets qu'un utilisateur peut choisir comme actif pour un de ses mondes
 * (V1-C5) : les officiels (2014, 2024) et les variantes qu'il a lui-meme
 * creees. Filtre applicatif explicite plutot que de s'appuyer sur la seule
 * RLS (`rulesets_select`) : celle-ci autorise aussi la lecture d'un ruleset
 * lie a une campagne/un monde dont l'utilisateur est simple membre, ce qui
 * polluerait ce selecteur avec des variantes qui ne lui appartiennent pas.
 */
export async function listSelectableRulesets(supabase: TypedClient, userId: string): Promise<SelectableRulesetRow[]> {
  const { data, error } = await supabase
    .from("rulesets")
    .select("id, name, is_official_base, base_system, version, published_at")
    .or(`is_official_base.eq.true,created_by.eq.${userId}`)
    .order("is_official_base", { ascending: false })
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return data;
}

/** Nouvelle variante vierge (aucune surcharge encore) enracinee sur un ruleset parent — RLS (`rulesets_write`) exige `created_by = auth.uid()`. */
export async function insertRulesetVariant(
  supabase: TypedClient,
  params: { name: string; baseSystem: string; parentRulesetId: string; createdBy: string }
): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from("rulesets")
    .insert({
      name: params.name,
      base_system: params.baseSystem,
      parent_ruleset_id: params.parentRulesetId,
      is_official_base: false,
      created_by: params.createdBy,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export interface RulesetOverrideRow {
  block_type: string | null;
  action: string;
  payload: Json;
  patch: Json;
}

/**
 * Surcharges d'UNE cle, dans UN ruleset precis (V1-A4, SCHEMA.md §9.4) —
 * aucune remontee de chaine ici, c'est le travail du service appelant
 * (resolveRulesetChain), qui les collecte a chaque niveau de la chaine et
 * les applique dans l'ordre racine -> feuille via src/core/rules/resolve.ts.
 */
export async function listOverridesForRuleset(
  supabase: TypedClient,
  rulesetId: string,
  entryKey: string
): Promise<RulesetOverrideRow[]> {
  const { data, error } = await supabase
    .from("ruleset_overrides")
    .select("block_type, action, payload, patch")
    .eq("ruleset_id", rulesetId)
    .eq("entry_key", entryKey)
    .order("created_at");
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

// Meme borne que TRANSLATION_BATCH_SIZE plus bas : defensif, les cles
// ciblees par les renvois d'une seule entree restent en pratique tres en
// dessous (quelques dizaines pour une classe), mais la marge ne coute rien.
const ENTRY_KEYS_BATCH_SIZE = 200;

/**
 * Plusieurs entrees d'UN ruleset par leur entry_key, en un ou plusieurs
 * appels plutot qu'un par cle (resolution des renvois sortants, V1-A3). Ne
 * remonte pas la chaine de parente : l'appelant retombe sur
 * getRulesetEntryByKey pour les cles absentes du resultat (rare tant que
 * les surcharges, V1-A4, n'existent pas).
 */
export async function listRulesetEntriesByKeys(
  supabase: TypedClient,
  rulesetId: string,
  entryKeys: string[]
): Promise<RulesetEntryRow[]> {
  const all: RulesetEntryRow[] = [];
  for (let i = 0; i < entryKeys.length; i += ENTRY_KEYS_BATCH_SIZE) {
    const batch = entryKeys.slice(i, i + ENTRY_KEYS_BATCH_SIZE);
    const { data, error } = await supabase
      .from("ruleset_entries")
      .select("id, ruleset_id, entry_key, entry_type, source_attribution, source_raw")
      .eq("ruleset_id", rulesetId)
      .in("entry_key", batch);
    if (error) throw new Error(error.message);
    all.push(...data);
  }
  return all;
}

export interface RulesetEntrySummaryRow {
  id: string;
  entry_key: string;
  entry_type: string;
  source_raw: Json;
}

export interface RulesetEntryChipRow {
  id: string;
  entry_key: string;
  entry_type: string;
  source_raw: Json;
  ai_digest: string | null;
}

/**
 * Entrees d'UN ruleset par cle, avec leur resume `ai_digest` (V1-B2,
 * resolution de `<RuleChip>`) — variante de `listRulesetEntriesByKeys` qui
 * n'a pas besoin de ce champ pour les renvois (V1-A3). Aucune remontee de
 * chaine ici, meme convention que le reste de ce fichier.
 */
export async function listRulesetEntryChipsByKeys(
  supabase: TypedClient,
  rulesetId: string,
  entryKeys: string[]
): Promise<RulesetEntryChipRow[]> {
  if (entryKeys.length === 0) return [];
  const all: RulesetEntryChipRow[] = [];
  for (let i = 0; i < entryKeys.length; i += ENTRY_KEYS_BATCH_SIZE) {
    const batch = entryKeys.slice(i, i + ENTRY_KEYS_BATCH_SIZE);
    const { data, error } = await supabase
      .from("ruleset_entries")
      .select("id, entry_key, entry_type, source_raw, ai_digest")
      .eq("ruleset_id", rulesetId)
      .in("entry_key", batch);
    if (error) throw new Error(error.message);
    all.push(...data);
  }
  return all;
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

export interface EntryTranslationWithBlocksRow extends EntryTranslationRow {
  /** Surcharges de contenu par block_type (V1-A5) — ex: { description: { segments: [...] } }, texte officiel verifie mot pour mot. */
  blocks: Json;
}

/** Traduction d'une seule entree (fiche de regle) : `null` si aucune traduction n'existe pour cette locale — l'appelant retombe sur le nom source (anglais). */
export async function getEntryTranslation(
  supabase: TypedClient,
  entryId: string,
  locale: string
): Promise<EntryTranslationWithBlocksRow | null> {
  const { data, error } = await supabase
    .from("ruleset_entry_translations")
    .select("entry_id, locale, name, source, blocks")
    .eq("entry_id", entryId)
    .eq("locale", locale)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

// 500 UUID dans un .in() depasse la limite d'en-tetes HTTP par defaut de
// undici (16 Ko) : constate en production (HeadersOverflowError, URL de
// 19627 caracteres). 200 est confirme sur : marge large avant la limite.
const TRANSLATION_BATCH_SIZE = 200;

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

export interface RulesetEntryRefRow {
  id: string;
  source_entry_id: string;
  target_key: string;
  target_entry_id: string | null;
  ref_kind: string;
  origin: string;
  path: string | null;
  note: string | null;
}

/** Renvois sortants d'une fiche (V1-A3, SCHEMA.md §9.3) : tout ce que cette entree cite. */
export async function listOutgoingRefs(supabase: TypedClient, entryId: string): Promise<RulesetEntryRefRow[]> {
  const { data, error } = await supabase
    .from("ruleset_entry_refs")
    .select("id, source_entry_id, target_key, target_entry_id, ref_kind, origin, path, note")
    .eq("source_entry_id", entryId);
  if (error) throw new Error(error.message);
  return data;
}

export interface IncomingRefRow extends RulesetEntryRefRow {
  source_entry_key: string;
  source_entry_type: string;
  source_source_raw: Json;
}

/**
 * Renvois entrants vers `targetKey` : tout ce qui cite cette fiche. Deux
 * requetes a plat plutot qu'une jointure imbriquee (meme style que le reste
 * de ce fichier) — `ruleset_entry_refs` n'a que target_key, jamais
 * target_entry_id comme cle de recherche (SCHEMA.md §9.3 : la cle traverse
 * la chaine d'heritage, l'identifiant non), donc on filtre par ruleset_id
 * apres coup plutot que de faire confiance a un cache pouvant dater.
 */
export async function listIncomingRefsForKey(
  supabase: TypedClient,
  rulesetId: string,
  targetKey: string
): Promise<IncomingRefRow[]> {
  const { data: refs, error: refsError } = await supabase
    .from("ruleset_entry_refs")
    .select("id, source_entry_id, target_key, target_entry_id, ref_kind, origin, path, note")
    .eq("target_key", targetKey);
  if (refsError) throw new Error(refsError.message);
  if (refs.length === 0) return [];

  const { data: sources, error: sourcesError } = await supabase
    .from("ruleset_entries")
    .select("id, ruleset_id, entry_key, entry_type, source_raw")
    .in(
      "id",
      refs.map((r) => r.source_entry_id)
    );
  if (sourcesError) throw new Error(sourcesError.message);

  const sourceById = new Map(sources.map((s) => [s.id, s]));
  const result: IncomingRefRow[] = [];
  for (const ref of refs) {
    const source = sourceById.get(ref.source_entry_id);
    if (!source || source.ruleset_id !== rulesetId) continue;
    result.push({
      ...ref,
      source_entry_key: source.entry_key,
      source_entry_type: source.entry_type,
      source_source_raw: source.source_raw,
    });
  }
  return result;
}
