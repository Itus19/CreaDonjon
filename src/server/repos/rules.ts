import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import type { OverrideAction } from "@/src/core/rules/resolve";

type TypedClient = SupabaseClient<Database>;

export interface RulesetRow {
  id: string;
  name: string;
  parent_ruleset_id: string | null;
  is_official_base: boolean;
  base_system: string;
  content_origin: string;
}

export async function getRulesetById(supabase: TypedClient, id: string): Promise<RulesetRow | null> {
  const { data, error } = await supabase
    .from("rulesets")
    .select("id, name, parent_ruleset_id, is_official_base, base_system, content_origin")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** Ruleset officiel de base d'un systeme donne ('dnd_srd_51'|'dnd_srd_52') — `null` si aucun (base custom sans officiel). Un seul par systeme en pratique (verrou officiel, SCHEMA.md §9.5). */
export async function getOfficialBaseRulesetId(supabase: TypedClient, baseSystem: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("rulesets")
    .select("id")
    .eq("is_official_base", true)
    .eq("base_system", baseSystem)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id ?? null;
}

export interface SelectableRulesetRow {
  id: string;
  name: string;
  is_official_base: boolean;
  base_system: string;
  version: number;
  published_at: string | null;
  content_origin: string;
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
    .select("id, name, is_official_base, base_system, version, published_at, content_origin")
    .or(`is_official_base.eq.true,created_by.eq.${userId}`)
    .order("is_official_base", { ascending: false })
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Nouvelle variante vierge (aucune surcharge encore) enracinee sur un
 * ruleset parent — RLS (`rulesets_write`) exige `created_by = auth.uid()`.
 * `contentOrigin` : jamais `official_srd` ici (reserve a l'import SRD,
 * jamais a une creation utilisateur) — `user_created` (regle maison) ou
 * `personal_reference` (V1-D5, specs/ruleset-personnel.md), verrouille une
 * fois pose (`rulesets_forbid_personal_reference_downgrade`, migration
 * 20260817130001 : aucune bascule hors de `personal_reference`).
 */
export async function insertRulesetVariant(
  supabase: TypedClient,
  params: {
    name: string;
    baseSystem: string;
    parentRulesetId: string;
    createdBy: string;
    contentOrigin: "user_created" | "personal_reference";
  }
): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from("rulesets")
    .insert({
      name: params.name,
      base_system: params.baseSystem,
      parent_ruleset_id: params.parentRulesetId,
      is_official_base: false,
      created_by: params.createdBy,
      content_origin: params.contentOrigin,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export type DeleteRulesetOutcome = "deleted" | "not_found" | "in_use";

/**
 * Supprime une variante (V1-C5 suite). Trois issues, jamais une exception
 * pour les deux dernieres — ce sont des refus attendus, pas une panne :
 * - `not_found` : RLS (`rulesets_write`, `created_by = auth.uid()`) a
 *   bloque en silence (0 ligne supprimee) — recouvre a la fois "n'existe
 *   pas" et "appartient a quelqu'un d'autre", indiscernables depuis l'exterieur.
 * - `in_use` : contrainte de cle etrangere refusee (23503) — un monde ou
 *   une campagne pointe encore dessus (`worlds.default_ruleset_id`,
 *   `campaigns.ruleset_id`, aucune n'a de `on delete cascade`), ou une
 *   autre variante a `parent_ruleset_id` pointant ici. Pas de verification
 *   prealable de chacun de ces trois cas : la contrainte fait deja ce
 *   travail de maniere atomique, la dupliquer cote application ouvrirait
 *   une fenetre de race (verifie -> plus vrai -> supprime quand meme).
 */
export async function deleteRuleset(supabase: TypedClient, id: string): Promise<DeleteRulesetOutcome> {
  const { error, count } = await supabase.from("rulesets").delete({ count: "exact" }).eq("id", id);
  if (error) {
    if (error.code === "23503") return "in_use";
    throw new Error(error.message);
  }
  return (count ?? 0) > 0 ? "deleted" : "not_found";
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
    .select("block_type, action, payload, patch, created_at")
    .eq("ruleset_id", rulesetId)
    .eq("entry_key", entryKey)
    .order("created_at");
  if (error) throw new Error(error.message);
  // `created_at` n'est PAS fiable pour ordonner deux `add_block` entre eux
  // (retour utilisateur : l'ordre des blocs d'une fiche maison ne suivait
  // pas l'ordre saisi — trouve en pratique sur une fiche recreee : le bloc
  // `background` gardait le timestamp de sa toute PREMIERE ecriture malgre
  // plusieurs recreations, l'upsert sur le meme index unique
  // `(entry_key, block_type)` ne rafraichissant que payload/patch, jamais
  // `created_at` — deux `add_block` distants dans le temps pouvaient donc se
  // retrouver dans le mauvais ordre l'un par rapport a l'autre). Seul
  // `display_order` (deja porte par le payload d'un `add_block`, ecrit par
  // l'appelant a chaque import — l'ordre reellement voulu) fait foi entre
  // deux `add_block` ; les autres actions (`add_entry`/`disable_entry`,
  // `patch_block`/`replace_block`/`remove_block`) gardent l'ordre
  // chronologique — leur position ne deplace jamais un bloc dans la liste
  // finale, `applyOverrides` les applique en place sur le bloc deja present.
  return sortOverrideRows(data);
}

function sortOverrideRows(rows: { block_type: string | null; action: string; payload: Json; patch: Json | null; created_at: string }[]): RulesetOverrideRow[] {
  return [...rows]
    .sort((a, b) => {
      if (a.action === "add_block" && b.action === "add_block") {
        const orderA = (a.payload as { display_order?: number } | null)?.display_order ?? 0;
        const orderB = (b.payload as { display_order?: number } | null)?.display_order ?? 0;
        if (orderA !== orderB) return orderA - orderB;
      }
      return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0;
    })
    .map(({ block_type, action, payload, patch }) => ({ block_type, action, payload, patch }));
}

/**
 * Meme regle, surcharges de PLUSIEURS rulesets en une seule requete (audit
 * de performance) — remplace `listOverridesForRuleset` appele niveau par
 * niveau sur toute une chaine deja connue (`resolveEntryBlocksInRuleset`,
 * `getRuleEntryForWorld`, `resolveHomebrewEntryDisplay`) : un personnage
 * resout une dizaine de cles en parallele, chacune remontant toute la
 * chaine — jusqu'a 8 requetes sequentielles par cle rien que pour ça.
 */
export async function listOverridesAcrossRulesets(
  supabase: TypedClient,
  rulesetIds: string[],
  entryKey: string
): Promise<Map<string, RulesetOverrideRow[]>> {
  const result = new Map<string, RulesetOverrideRow[]>();
  if (rulesetIds.length === 0) return result;
  const { data, error } = await supabase
    .from("ruleset_overrides")
    .select("ruleset_id, block_type, action, payload, patch, created_at")
    .in("ruleset_id", rulesetIds)
    .eq("entry_key", entryKey);
  if (error) throw new Error(error.message);
  const byRuleset = new Map<string, typeof data>();
  for (const row of data) {
    const list = byRuleset.get(row.ruleset_id) ?? [];
    list.push(row);
    byRuleset.set(row.ruleset_id, list);
  }
  for (const [rulesetId, rows] of byRuleset) {
    result.set(rulesetId, sortOverrideRows(rows));
  }
  return result;
}

/**
 * Meme regle, PLUSIEURS cles a la fois (audit de performance) — remplace
 * `listOverridesAcrossRulesets` appele une fois par cle
 * (`fetchEquipmentBlocks`, un objet d'inventaire a la fois).
 */
export async function listOverridesAcrossRulesetsForKeys(
  supabase: TypedClient,
  rulesetIds: string[],
  entryKeys: string[]
): Promise<Map<string, Map<string, RulesetOverrideRow[]>>> {
  const result = new Map<string, Map<string, RulesetOverrideRow[]>>();
  if (rulesetIds.length === 0 || entryKeys.length === 0) return result;
  const { data, error } = await supabase
    .from("ruleset_overrides")
    .select("ruleset_id, entry_key, block_type, action, payload, patch, created_at")
    .in("ruleset_id", rulesetIds)
    .in("entry_key", entryKeys);
  if (error) throw new Error(error.message);
  const byKeyThenRuleset = new Map<string, Map<string, typeof data>>();
  for (const row of data) {
    const byRuleset = byKeyThenRuleset.get(row.entry_key) ?? new Map<string, typeof data>();
    const list = byRuleset.get(row.ruleset_id) ?? [];
    list.push(row);
    byRuleset.set(row.ruleset_id, list);
    byKeyThenRuleset.set(row.entry_key, byRuleset);
  }
  for (const [entryKey, byRuleset] of byKeyThenRuleset) {
    const sorted = new Map<string, RulesetOverrideRow[]>();
    for (const [rulesetId, rows] of byRuleset) sorted.set(rulesetId, sortOverrideRows(rows));
    result.set(entryKey, sorted);
  }
  return result;
}

export interface EntryLevelOverrideRow {
  entry_key: string;
  action: string;
  payload: Json;
}

/**
 * Surcharges de niveau ENTREE (`add_entry`/`disable_entry`, `block_type is
 * null`) d'UN ruleset, toutes cles confondues (V1-D4) — complement de
 * `listOverridesForRuleset`, qui exige de connaitre la cle d'avance. Sert au
 * listing (barre laterale, auto-completion) : une fiche maison n'a par
 * definition aucune cle connue tant qu'elle n'est pas apparue dans une liste.
 * Ne remonte pas la chaine : meme convention que le reste de ce fichier,
 * c'est au service appelant de la parcourir niveau par niveau.
 */
export async function listEntryLevelOverridesForRuleset(
  supabase: TypedClient,
  rulesetId: string
): Promise<EntryLevelOverrideRow[]> {
  const { data, error } = await supabase
    .from("ruleset_overrides")
    .select("entry_key, action, payload")
    .eq("ruleset_id", rulesetId)
    .is("block_type", null)
    .in("action", ["add_entry", "disable_entry"]);
  if (error) throw new Error(error.message);
  return data;
}

export interface UpsertRulesetOverrideParams {
  rulesetId: string;
  entryKey: string;
  blockType: string | null;
  action: OverrideAction;
  payload: Json;
  patch: Json;
  note: string | null;
}

/**
 * Ecrit une surcharge via `app.upsert_ruleset_override` (migration
 * 20260803090001, V1-A4) plutot qu'un insert direct dans
 * `ruleset_overrides` : la fonction verifie le verrou officiel et gere le
 * fork-sur-publication cote serveur (`security definer`, `auth.uid()` lu a
 * l'interieur) — dupliquer cette logique cote TypeScript ouvrirait une
 * fenetre pour la contourner. Renvoie l'id du ruleset qui a reellement
 * recu la ligne : identique a `rulesetId` si le brouillon etait encore
 * modifiable, differe si l'appel a du forker une nouvelle version (ruleset
 * deja publie) — l'appelant doit reutiliser cet id pour toute surcharge
 * suivante visant la meme fiche (ex: `add_entry` puis `add_block`).
 *
 * `blockType`/`note` castes en `string` au point d'appel : le generateur de
 * types Supabase ne modelise jamais la nullabilite d'un parametre de
 * fonction (seulement celle des colonnes de table), alors que
 * `block_type is null` est la forme valide pour `add_entry`/`disable_entry`/
 * `replace_entry` (SCHEMA.md §9.4, contrainte `overrides_block_required`).
 */
export async function upsertRulesetOverride(
  supabase: TypedClient,
  params: UpsertRulesetOverrideParams
): Promise<string> {
  const { data, error } = await supabase.rpc("upsert_ruleset_override", {
    p_ruleset_id: params.rulesetId,
    p_entry_key: params.entryKey,
    p_block_type: params.blockType as unknown as string,
    p_action: params.action,
    p_payload: params.payload,
    p_patch: params.patch,
    p_note: params.note as unknown as string,
  });
  if (error) throw new Error(error.message);
  return data;
}

/** Fige la version courante du ruleset (V1-A4, SCHEMA.md §9.4/§3.4) — idempotent, aucun effet si deja publie. */
export async function publishRuleset(supabase: TypedClient, rulesetId: string): Promise<void> {
  const { error } = await supabase.rpc("publish_ruleset", { p_ruleset_id: rulesetId });
  if (error) throw new Error(error.message);
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

/**
 * Meme regle, cherchee en une seule requete a travers PLUSIEURS rulesets —
 * pense pour une chaine d'heritage deja connue de l'appelant (audit de
 * performance, retour utilisateur). Remplace un `getRulesetEntryByKey`
 * appele une fois par niveau de chaine, sequentiellement, jusqu'a trouver
 * une reponse (`getRuleEntryForWorld`/`resolveEntryBlocksInRuleset`) : sur
 * une chaine base -> variante -> variante personnelle, chercher une regle
 * officielle (la grande majorite du contenu) marchait jusqu'a 8 requetes en
 * serie pour finir par trouver la reponse au niveau le plus ancestral.
 * `rulesetIds` doit rester dans l'ordre feuille -> racine : l'appelant
 * choisit la ligne du ruleset le plus specifique qui a une reponse parmi
 * celles renvoyees, jamais cette fonction (elle ne connait pas cet ordre).
 */
export async function getRulesetEntryByKeyAcrossRulesets(
  supabase: TypedClient,
  rulesetIds: string[],
  entryKey: string
): Promise<RulesetEntryRow[]> {
  if (rulesetIds.length === 0) return [];
  const { data, error } = await supabase
    .from("ruleset_entries")
    .select("id, ruleset_id, entry_key, entry_type, source_attribution, source_raw")
    .in("ruleset_id", rulesetIds)
    .eq("entry_key", entryKey);
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Meme regle, PLUSIEURS cles a la fois a travers toute une chaine (audit de
 * performance) — remplace `getRulesetEntryByKeyAcrossRulesets` appele une
 * fois par cle (`fetchEquipmentBlocks`, un aller-retour par objet
 * d'inventaire, en parallele mais quand meme un aller-retour chacun).
 */
export async function getRulesetEntriesByKeysAcrossRulesets(
  supabase: TypedClient,
  rulesetIds: string[],
  entryKeys: string[]
): Promise<RulesetEntryRow[]> {
  if (rulesetIds.length === 0 || entryKeys.length === 0) return [];
  const { data, error } = await supabase
    .from("ruleset_entries")
    .select("id, ruleset_id, entry_key, entry_type, source_attribution, source_raw")
    .in("ruleset_id", rulesetIds)
    .in("entry_key", entryKeys);
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Un lot de cles/ids en plusieurs requetes PARALLELES plutot que
 * sequentielles (V2-G1, retour utilisateur : "lenteur generale" — chaque
 * paire de lots attendait la precedente avant de lancer la suivante, un
 * total qui peut depasser dix allers-retours des qu'un ruleset officiel
 * approche ou depasse le millier d'entrees, mesure a ~4s pour le SRD 2024
 * complet). Chaque lot ne depend d'aucun autre : les lancer ensemble ne
 * change rien au resultat, seulement au temps d'attente.
 */
async function fetchBatched<T, R>(items: T[], batchSize: number, fetchBatch: (batch: T[]) => Promise<R[]>): Promise<R[]> {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) batches.push(items.slice(i, i + batchSize));
  const results = await Promise.all(batches.map(fetchBatch));
  return results.flat();
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
  return fetchBatched(entryKeys, ENTRY_KEYS_BATCH_SIZE, async (batch) => {
    const { data, error } = await supabase
      .from("ruleset_entries")
      .select("id, ruleset_id, entry_key, entry_type, source_attribution, source_raw")
      .eq("ruleset_id", rulesetId)
      .in("entry_key", batch);
    if (error) throw new Error(error.message);
    return data;
  });
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
  return fetchBatched(entryKeys, ENTRY_KEYS_BATCH_SIZE, async (batch) => {
    const { data, error } = await supabase
      .from("ruleset_entries")
      .select("id, entry_key, entry_type, source_raw, ai_digest")
      .eq("ruleset_id", rulesetId)
      .in("entry_key", batch);
    if (error) throw new Error(error.message);
    return data;
  });
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
/**
 * Marge de pages tirees en parallele apres la premiere (V2-G1, retour
 * utilisateur : "lenteur generale" — /rule-entries prenait ~4s pour le SRD
 * 2024, 1904 entrees en pages sequentielles). Le total est inconnu tant que
 * la premiere page n'est pas revenue (on ne sait pas s'il y en a une
 * deuxieme) ; au-dela, largement assez pour tout ruleset reel (9 pages
 * de plus = jusqu'a 10 000 entrees) — quelques pages vides en trop pres de
 * la limite reelle coutent moins cher qu'un aller-retour sequentiel de plus.
 */
const MAX_EXTRA_PAGES = 9;

export async function listRulesetEntries(
  supabase: TypedClient,
  rulesetId: string
): Promise<RulesetEntrySummaryRow[]> {
  const fetchPage = async (from: number) => {
    const { data, error } = await supabase
      .from("ruleset_entries")
      .select("id, entry_key, entry_type, source_raw")
      .eq("ruleset_id", rulesetId)
      // `.order()` explicite (bug reel trouve en verifiant la sous-espece,
      // V2-G1 suite) — sans lui, Postgres ne garantit AUCUN ordre stable
      // entre deux executions de la meme requete : deux `.range()` qui se
      // pensent contigus peuvent alors se chevaucher ou laisser un trou,
      // des entrees apparaissant/disparaissant au hasard d'un appel a
      // l'autre (constate : nain/elfe/humain/halfelin manquants une fois
      // sur plusieurs, jamais les memes). `id` est la cle primaire, jamais
      // ambigu contrairement a `entry_key` qui pourrait un jour ne pas etre
      // unique a lui seul.
      .order("id")
      .range(from, from + LIST_PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    return data;
  };

  const first = await fetchPage(0);
  if (first.length < LIST_PAGE_SIZE) return first;

  const extraPages = await Promise.all(
    Array.from({ length: MAX_EXTRA_PAGES }, (_, i) => fetchPage((i + 1) * LIST_PAGE_SIZE))
  );
  return [first, ...extraPages].flat();
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

/**
 * Meme lecture que `getEntryTranslation` (avec les surcharges `blocks`, pas
 * seulement nom/source comme `listTranslationsForEntries`), pour PLUSIEURS
 * entrees en lot — assistant de creation de personnage, meme raison que
 * `listBlocksForRulesetEntries`.
 */
export async function listEntryTranslationsWithBlocks(
  supabase: TypedClient,
  entryIds: string[],
  locale: string
): Promise<EntryTranslationWithBlocksRow[]> {
  if (entryIds.length === 0) return [];
  return fetchBatched(entryIds, TRANSLATION_BATCH_SIZE, async (batch) => {
    const { data, error } = await supabase
      .from("ruleset_entry_translations")
      .select("entry_id, locale, name, source, blocks")
      .eq("locale", locale)
      .in("entry_id", batch);
    if (error) throw new Error(error.message);
    return data;
  });
}

/** Toutes les traductions disponibles pour un ensemble d'entrees (barre laterale) : pagine l'IN, meme raison que listRulesetEntries. */
export async function listTranslationsForEntries(
  supabase: TypedClient,
  entryIds: string[],
  locale: string
): Promise<EntryTranslationRow[]> {
  return fetchBatched(entryIds, TRANSLATION_BATCH_SIZE, async (batch) => {
    const { data, error } = await supabase
      .from("ruleset_entry_translations")
      .select("entry_id, locale, name, source")
      .eq("locale", locale)
      .in("entry_id", batch);
    if (error) throw new Error(error.message);
    return data;
  });
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

/**
 * Meme lecture que `listBlocksForRulesetEntry`, pour PLUSIEURS entrees en un
 * ou plusieurs appels (assistant de creation de personnage, V2-G1 suite) —
 * evite le N+1 d'un appel par sort quand la liste candidate compte plusieurs
 * centaines d'entrees (bug reel trouve en verifiant l'etape Sorts : plusieurs
 * secondes de chargement, chaque cle refaisant tout le travail de
 * `getRuleEntryPageData` — monde, chaine de rulesets, entree, traduction,
 * blocs — depuis zero).
 */
export async function listBlocksForRulesetEntries(supabase: TypedClient, entryIds: string[]): Promise<RulesetEntryBlockRow[]> {
  if (entryIds.length === 0) return [];
  return fetchBatched(entryIds, ENTRY_KEYS_BATCH_SIZE, async (batch) => {
    const { data, error } = await supabase
      .from("ruleset_entry_blocks")
      .select("id, entry_id, block_type, schema_version, display, data, display_order")
      .in("entry_id", batch)
      .order("display_order");
    if (error) throw new Error(error.message);
    return data;
  });
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
