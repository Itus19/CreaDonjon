import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import {
  dataSchemaForBlockType,
  zWeaponBlockData,
  type AddEntryPayload,
  type BackgroundBlockData,
  type BackgroundEquipmentItem,
  type BackgroundEquipmentOption,
  type BlockType,
  type ClassEquipmentBlockData,
  type ClassProgressionBlockData,
  type EffectsBlockData,
  type EntryType,
  type ItemPropertiesBlockData,
  type ReferencePrimitive,
  type ScalingBlockData,
  type SpeciesTraitsBlockData,
  type StatBlockBlockData,
  type SubclassSlotBlockData,
  type WeaponBlockData,
  zAddEntryPayload,
  zBlockDisplay,
} from "@/src/core/schemas/rule-blocks";
import { generateScalingTable, resolveScalingTarget } from "@/src/core/rules/scaling";
import { computeProgressionRows } from "@/src/core/rules/progression";
import { missingRequiredBlocks } from "@/src/core/rules/requiredBlocks";
import { nextSlugCandidate, slugify } from "@/src/core/slug/slug";
import {
  applyOverrides,
  mergeHomebrewEntries,
  MAX_RULESET_CHAIN_DEPTH,
  RulesetChainCycleError,
  RulesetChainDepthError,
  type OverrideInput,
  type ResolvableBlock,
  type ResolvableEntry,
} from "@/src/core/rules/resolve";
import {
  deleteRuleset,
  getEntryTranslation,
  getRulesetById,
  getRulesetEntryByKey,
  insertRulesetVariant,
  listBlocksForRulesetEntry,
  listBlocksForRulesetEntries,
  listEntryLevelOverridesForRuleset,
  listEntryTranslationsWithBlocks,
  listIncomingRefsForKey,
  listOutgoingRefs,
  listOverridesForRuleset,
  listRulesetEntries,
  listRulesetEntriesByKeys,
  listSelectableRulesets,
  listTranslationsForEntries,
  upsertRulesetOverride,
  type DeleteRulesetOutcome,
  type SelectableRulesetRow,
  type RulesetEntryRow,
} from "@/src/server/repos/rules";
import { getWorldDefaultRulesetId, setWorldDefaultRuleset } from "@/src/server/repos/worlds";
import { getWorldBySlug } from "@/src/server/services/worlds";
import type { Locale } from "@/src/i18n/request";

type TypedClient = SupabaseClient<Database>;

const SLOT_LEVEL_MAX = 9;
const CHARACTER_LEVEL_MAX = 20;

export interface RulesetChainLink {
  rulesetId: string;
  parentRulesetId: string | null;
  /** V1-D5, specs/ruleset-personnel.md — sert a marquer une fiche "reference personnelle" quand une surcharge de ce niveau la touche reellement. */
  contentOrigin: string;
}

/**
 * Chaine de heritage d'un ruleset, du plus specifique (celui du monde) au
 * plus ancestral (l'officiel, en general) — feuille -> racine. Detection de
 * cycle explicite (V1-A4, SCHEMA.md §9.4) : un ensemble visite, pas
 * seulement la borne de profondeur, pour distinguer une vraie boucle
 * (erreur) d'une chaine simplement longue (erreur differente).
 */
export async function walkRulesetChain(supabase: TypedClient, startRulesetId: string): Promise<RulesetChainLink[]> {
  const chain: RulesetChainLink[] = [];
  const visited = new Set<string>();
  let currentId: string | null = startRulesetId;

  while (currentId) {
    if (visited.has(currentId)) throw new RulesetChainCycleError(currentId);
    visited.add(currentId);
    if (chain.length >= MAX_RULESET_CHAIN_DEPTH) throw new RulesetChainDepthError();

    const ruleset = await getRulesetById(supabase, currentId);
    if (!ruleset) break;
    chain.push({ rulesetId: currentId, parentRulesetId: ruleset.parent_ruleset_id, contentOrigin: ruleset.content_origin });
    currentId = ruleset.parent_ruleset_id;
  }

  return chain;
}

/**
 * Un monde variante n'a d'entrees que pour ce qu'il surcharge (V1-A4) —
 * aujourd'hui zero, tant que les surcharges ne sont pas construites. Sans
 * remonter au parent, aucune fiche de regle n'existe jamais pour un monde
 * dont le ruleset par defaut est une variante. Remonter n'est pas encore
 * de la resolution de surcharge (pas de patch/replace/disable appliques
 * ici) : c'est le minimum pour qu'un ruleset "sans rien a soi" ait un sens.
 */
export async function findEntryInRulesetChain(
  supabase: TypedClient,
  rulesetId: string,
  entryKey: string
): Promise<RulesetEntryRow | null> {
  let currentId: string | null = rulesetId;
  for (let hop = 0; currentId && hop < MAX_RULESET_CHAIN_DEPTH; hop++) {
    const entry = await getRulesetEntryByKey(supabase, currentId, entryKey);
    if (entry) return entry;
    const ruleset = await getRulesetById(supabase, currentId);
    currentId = ruleset?.parent_ruleset_id ?? null;
  }
  return null;
}

export interface ResolvedEntryBlocks {
  entryType: EntryType;
  /** Donnee de chaque bloc deja validee par son schema Zod, indexee par block_type — jamais la ligne brute. */
  blocksByType: Map<string, unknown>;
}

/**
 * Resout une entree jusqu'a ses blocs valides : base (si elle existe dans
 * la chaine) + TOUTES les surcharges de la chaine, racine -> feuille
 * (V1-A4/V1-D4) — meme moteur (`applyOverrides`) que `getRuleEntryForWorld`,
 * mais sans ses etapes d'affichage (traductions, renvois, augmentation de
 * noms) : pour les consommateurs mecaniques (`resolvedRuleset.ts`, actions
 * de jeu) qui n'ont besoin que de la donnee brute d'un bloc, jamais de sa
 * mise en page. Contrairement a `findEntryInRulesetChain` (utilise par ce
 * meme fichier pour d'autres besoins, jamais surcharge-aware), une fiche
 * qui n'existe que par une surcharge `add_entry` (aucune ligne
 * `ruleset_entries`, V1-D4) resout ici correctement. `null` si l'entree
 * n'existe nulle part dans la chaine (ni base, ni `add_entry`) ou si une
 * surcharge l'a desactivee.
 */
export async function resolveEntryBlocksInRuleset(
  supabase: TypedClient,
  rulesetId: string,
  entryKey: string
): Promise<ResolvedEntryBlocks | null> {
  const chain = await walkRulesetChain(supabase, rulesetId);

  let entry: RulesetEntryRow | null = null;
  for (const link of chain) {
    entry = await getRulesetEntryByKey(supabase, link.rulesetId, entryKey);
    if (entry) break;
  }

  const blockRows = entry ? await listBlocksForRulesetEntry(supabase, entry.id) : [];
  const baseEntry: ResolvableEntry | null = entry
    ? {
        entry_key: entry.entry_key,
        entry_type: entry.entry_type,
        blocks: blockRows.map(
          (row): ResolvableBlock => ({
            block_type: row.block_type,
            display: row.display,
            data: row.data,
            display_order: row.display_order,
          })
        ),
      }
    : null;

  const overrides: OverrideInput[] = [];
  for (const link of [...chain].reverse()) {
    const rows = await listOverridesForRuleset(supabase, link.rulesetId, entryKey);
    for (const row of rows) {
      if (row.action === "add_entry") {
        const addEntry = zAddEntryPayload.parse(row.payload);
        overrides.push({
          block_type: null,
          action: "add_entry",
          payload: { entry_key: entryKey, entry_type: addEntry.entry_type, blocks: [] } satisfies ResolvableEntry,
          patch: null,
        });
        continue;
      }
      overrides.push({
        block_type: row.block_type,
        action: row.action as OverrideInput["action"],
        payload: row.payload,
        patch: row.patch,
      });
    }
  }

  const resolved = applyOverrides(baseEntry, overrides);
  if (!resolved || resolved.disabled) return null;

  const blocksByType = new Map<string, unknown>();
  for (const block of resolved.blocks) {
    blocksByType.set(block.block_type, dataSchemaForBlockType(block.block_type as BlockType).parse(block.data));
  }

  return { entryType: resolved.entry_type as EntryType, blocksByType };
}

export interface RuleEntryBlockView {
  id: string;
  blockType: BlockType;
  display: { label: string; layout: string; collapsed?: boolean };
  data: unknown;
  displayOrder: number;
  /** Donnee avant surcharge (V1-A4) — present seulement si ce bloc est dans modifiedBlockTypes, pour le badge "modifiee dans ta variante". */
  originalData?: unknown;
}

/** Un renvoi affiche (V1-A3) : `key` designe l'AUTRE entree — la cible pour un renvoi sortant, la source pour un renvoi entrant. `entryType` absent = renvoi non resolu (cible disparue ou jamais importee). `level`/`description` (V1-D7, retour utilisateur) : uniquement pour un renvoi sortant `grants` (classe -> aptitude accordee a un niveau) — le niveau vient du `path`, le texte de la fiche visee, pour qu'un joueur voie l'effet sans quitter la fiche de classe. */
export interface RuleRefView {
  key: string;
  name: string;
  entryType: EntryType | null;
  refKind: string;
  path: string | null;
  level?: number;
  description?: string;
}

export interface RuleEntryDetail {
  id: string;
  entryKey: string;
  entryType: EntryType;
  name: string;
  sourceAttribution: string | null;
  blocks: RuleEntryBlockView[];
  missingBlocks: string[];
  outgoingRefs: RuleRefView[];
  incomingRefs: RuleRefView[];
  /** Types de blocs modifies par une surcharge de la variante courante (V1-A4) — badge "modifiee dans ta variante". */
  modifiedBlockTypes: string[];
  /** V1-D5, specs/ruleset-personnel.md — badge "reference personnelle" : au moins une surcharge d'un ruleset personal_reference de la chaine touche reellement cette fiche. */
  personalReference: boolean;
}

function maxLevelForAxis(axis: ScalingBlockData["axis"]): number {
  return axis === "slot_level" ? SLOT_LEVEL_MAX : CHARACTER_LEVEL_MAX;
}

export function entryNameFrom(entry: { entry_key: string; source_raw: unknown }): string {
  const sourceRaw = entry.source_raw as { name?: unknown } | null;
  const name = sourceRaw && typeof sourceRaw.name === "string" ? sourceRaw.name : null;
  return name ?? entry.entry_key;
}

/**
 * Renvois sortants d'une fiche, prets a afficher (V1-A3). Les cles cibles
 * sont resolues en un seul lot dans le ruleset courant — le cas normal tant
 * que les surcharges (V1-A4) n'existent pas — puis, pour les cles absentes
 * du lot, une par une via la remontee de chaine (rare : cible d'un ruleset
 * parent, ou renvoi non resolu si elle n'existe nulle part).
 */
async function resolveOutgoingRefs(
  supabase: TypedClient,
  rulesetId: string,
  rulesetEntryId: string,
  locale: Locale
): Promise<RuleRefView[]> {
  const refs = await listOutgoingRefs(supabase, rulesetEntryId);
  if (refs.length === 0) return [];

  const targetKeys = [...new Set(refs.map((r) => r.target_key))];
  const batched = await listRulesetEntriesByKeys(supabase, rulesetId, targetKeys);
  const byKey = new Map(batched.map((e) => [e.entry_key, e]));

  for (const key of targetKeys) {
    if (byKey.has(key)) continue;
    const found = await findEntryInRulesetChain(supabase, rulesetId, key);
    if (found) byKey.set(key, found);
  }

  const translationByEntryId = new Map<string, string>();
  if (locale !== "en" && byKey.size > 0) {
    const translations = await listTranslationsForEntries(
      supabase,
      [...byKey.values()].map((e) => e.id),
      locale
    );
    for (const t of translations) translationByEntryId.set(t.entry_id, t.name);
  }

  // V1-D7 (retour utilisateur) : un renvoi "grants" (le seul produit
  // aujourd'hui, cf. extractDerivedRefs) affiche aussi le texte de
  // l'aptitude visee et son niveau dans le panneau de renvois sortants, pour
  // qu'un joueur voie l'effet sans quitter la fiche de classe. Uniquement ce
  // ref_kind : un futur ref_kind sans niveau/texte pertinent (requires,
  // see_also...) resterait un simple nom.
  const grantsKeys = [...new Set(refs.filter((r) => r.ref_kind === "grants").map((r) => r.target_key))];
  const grantsDescriptions = new Map(
    (
      await Promise.all(
        grantsKeys.map(async (key) => [key, await resolveEntryDetail(supabase, rulesetId, key, locale)] as const)
      )
    ).map(([key, detail]) => [key, detail?.description])
  );

  return refs.map((ref) => {
    const target = byKey.get(ref.target_key);
    const levelMatch = ref.ref_kind === "grants" ? ref.path?.match(/rows\[(\d+)\]/) : null;
    return {
      key: ref.target_key,
      name: target ? (translationByEntryId.get(target.id) ?? entryNameFrom(target)) : ref.target_key,
      entryType: target ? (target.entry_type as EntryType) : null,
      refKind: ref.ref_kind,
      path: ref.path,
      level: levelMatch ? Number(levelMatch[1]) : undefined,
      description: grantsDescriptions.get(ref.target_key) || undefined,
    };
  });
}

/** Renvois entrants vers une fiche, prets a afficher (V1-A3) : tout ce qui la cite. */
async function resolveIncomingRefs(
  supabase: TypedClient,
  rulesetId: string,
  entryKey: string,
  locale: Locale
): Promise<RuleRefView[]> {
  const refs = await listIncomingRefsForKey(supabase, rulesetId, entryKey);
  if (refs.length === 0) return [];

  const translationByEntryId = new Map<string, string>();
  if (locale !== "en") {
    const translations = await listTranslationsForEntries(
      supabase,
      refs.map((r) => r.source_entry_id),
      locale
    );
    for (const t of translations) translationByEntryId.set(t.entry_id, t.name);
  }

  return refs.map((ref) => ({
    key: ref.source_entry_key,
    name:
      translationByEntryId.get(ref.source_entry_id) ??
      entryNameFrom({ entry_key: ref.source_entry_key, source_raw: ref.source_source_raw }),
    entryType: ref.source_entry_type as EntryType,
    refKind: ref.ref_kind,
    path: ref.path,
  }));
}

/**
 * `background.feat` (V1-D7) augmente de son propre nom et de sa propre
 * description au moment de la lecture — jamais stocke ainsi (le bloc en
 * base ne porte que la reference `{kind, key}`), memes noms que
 * `BackgroundBlockData` en plus. Portee volontairement limitee a ce seul
 * bloc : le mecanisme general de renvois (`outgoingRefs`/`RuleRefView`) ne
 * transporte que des noms, jamais de texte de description, et l'etendre
 * pour ce seul besoin aurait touche le panneau de renvois existant pour
 * rien — cf. plan approuve, ne pas generaliser sans un deuxieme cas concret.
 */
export type ResolvedBackgroundEquipmentItem = BackgroundEquipmentItem & { resolved_label: string };
export type ResolvedBackgroundEquipmentOption = Omit<BackgroundEquipmentOption, "items"> & {
  items: ResolvedBackgroundEquipmentItem[];
};
export type ResolvedBackgroundBlockData = Omit<BackgroundBlockData, "equipment_options"> & {
  feat_name: string;
  feat_description: string;
  equipment_options: ResolvedBackgroundEquipmentOption[];
};

/**
 * `class_equipment.fixed`/`.choices[].options` (V2-G1, point 9 du retour
 * utilisateur) augmentes du nom resolu de chaque objet reference, meme
 * motif exact que `ResolvedBackgroundBlockData` ci-dessus (memes types
 * d'item/d'option, reutilises tels quels — un choix d'equipement de classe
 * n'est jamais qu'un choix d'historique avec plusieurs choix INDEPENDANTS
 * au lieu d'un seul, pas une forme differente).
 */
export type ResolvedClassEquipmentBlockData = {
  fixed: ResolvedBackgroundEquipmentItem[];
  choices: { options: ResolvedBackgroundEquipmentOption[] }[];
};

/**
 * `subclass_slot.options` (V1-D7, retour utilisateur : le lien de chaque
 * sous-classe affichait sa cle technique brute, ex. "evoker") augmente d'un
 * nom resolu par option, meme motif que `ResolvedBackgroundBlockData`
 * ci-dessus — jamais stocke ainsi, calcule a la lecture.
 */
export type ResolvedSubclassSlotBlockData = Omit<SubclassSlotBlockData, "options"> & {
  options?: (ReferencePrimitive & { resolved_name: string })[];
};

/**
 * `weapon.properties`/`weapon.mastery` (V1-D7, retour utilisateur : d'abord
 * un simple lien, puis "il faut que ça soit directement visible sur la
 * fiche" — meme niveau de detail que `feat_name`/`feat_description` du bloc
 * `background`) augmentes du nom ET du texte de chaque propriete/botte,
 * jamais dupliques en base : lus a la lecture depuis leur propre fiche
 * `feature` existante (V1-C12/V1-D7), meme motif que `resolveEntryDetail`.
 */
export type ResolvedWeaponBlockData = Omit<WeaponBlockData, "properties" | "mastery"> & {
  properties: (ReferencePrimitive & { resolved_name: string; resolved_description: string })[];
  mastery?: ReferencePrimitive & { resolved_name: string; resolved_description: string };
};

/**
 * `species_traits.traits` (V1-D7, retour utilisateur — meme niveau de
 * detail que les proprietes d'arme ci-dessus) augmentes du nom ET de la
 * description de chaque trait, jamais dupliques en base.
 */
export type ResolvedSpeciesTraitsBlockData = Omit<SpeciesTraitsBlockData, "traits"> & {
  traits: (ReferencePrimitive & { resolved_name: string; resolved_description: string })[];
};

/**
 * `item_properties.contents` (V1-D7, passe Objet — paquetages d'aventurier)
 * augmente du nom resolu de chaque objet contenu, meme motif que
 * `background.equipment_options[].items` : seul le nom est necessaire (pas
 * de description imbriquee, contrairement a `weapon`/`species_traits`), donc
 * `resolveEntryNames` suffit plutot que `resolveEntryDetails`.
 */
export type ResolvedItemPropertiesBlockData = Omit<ItemPropertiesBlockData, "contents"> & {
  contents?: { ref?: ReferencePrimitive; label: string; quantity: number; resolved_label: string }[];
};

/**
 * Nom + description (deja traduite si `locale !== "en"`) d'une entree
 * quelconque de la chaine de ruleset. `null` seulement si la cle ne resout
 * dans aucun ruleset de la chaine (donnee source incoherente) — l'appelant
 * retombe alors sur la cle brute plutot que d'echouer la fiche entiere pour
 * un seul champ manquant. Utilise par `background.feat` (nom d'origine,
 * resolveFeatDetail) et par l'enrichissement des renvois "grants" du
 * panneau de renvois sortants (V1-D7, retour utilisateur) — generalisee au
 * deuxieme cas concret plutot que dupliquee.
 */
async function resolveEntryDetail(
  supabase: TypedClient,
  rulesetId: string,
  entryKey: string,
  locale: Locale
): Promise<{ name: string; description: string } | null> {
  const featEntry = await findEntryInRulesetChain(supabase, rulesetId, entryKey);
  if (!featEntry) return null;

  const translation = locale !== "en" ? await getEntryTranslation(supabase, featEntry.id, locale) : null;
  const translatedBlocks = (translation?.blocks ?? {}) as Record<string, unknown>;

  let description = "";
  const translatedDescription = translatedBlocks.description as { segments?: { text: string }[] } | undefined;
  if (translatedDescription?.segments) {
    description = translatedDescription.segments.map((s) => s.text).join("\n\n");
  } else {
    const blockRows = await listBlocksForRulesetEntry(supabase, featEntry.id);
    const descriptionRow = blockRows.find((b) => b.block_type === "description");
    const data = descriptionRow?.data as { segments?: { text: string }[] } | undefined;
    description = data?.segments?.map((s) => s.text).join("\n\n") ?? "";
  }

  return { name: translation?.name ?? entryNameFrom(featEntry), description };
}

/**
 * `resolveEntryDetail` sur un lot de cles uniques, en parallele (V1-D7,
 * troisieme appelant apres `weapon` et `species_traits` — generalise plutot
 * que duplique une troisieme fois, meme raison que `resolveEntryDetail`
 * lui-meme). Peu de cles par appelant (1 a 10), un `Promise.all` suffit,
 * pas besoin du lot SQL batche de `resolveEntryNames`.
 */
async function resolveEntryDetails(
  supabase: TypedClient,
  rulesetId: string,
  keys: string[],
  locale: Locale
): Promise<Map<string, { name: string; description: string } | null>> {
  const uniqueKeys = [...new Set(keys)];
  const entries = await Promise.all(
    uniqueKeys.map(async (key) => [key, await resolveEntryDetail(supabase, rulesetId, key, locale)] as const)
  );
  return new Map(entries);
}

/**
 * Nom (deja traduit si `locale !== "en"`) de chaque cle donnee, resolue
 * dans le ruleset ou sa chaine — meme lot batche + repli chaine que
 * `resolveOutgoingRefs`, extrait ici pour etre reutilise par
 * `background.equipment_options[].items[].ref` (V1-D7) sans dupliquer la
 * logique. Une cle absente du resultat n'a pas de fiche resoluble ;
 * l'appelant retombe alors sur le libelle fige ecrit a l'import.
 */
async function resolveEntryNames(
  supabase: TypedClient,
  rulesetId: string,
  keys: string[],
  locale: Locale
): Promise<Map<string, string>> {
  const uniqueKeys = [...new Set(keys)];
  if (uniqueKeys.length === 0) return new Map();

  const batched = await listRulesetEntriesByKeys(supabase, rulesetId, uniqueKeys);
  const byKey = new Map(batched.map((e) => [e.entry_key, e]));
  for (const key of uniqueKeys) {
    if (byKey.has(key)) continue;
    const found = await findEntryInRulesetChain(supabase, rulesetId, key);
    if (found) byKey.set(key, found);
  }

  const translationByEntryId = new Map<string, string>();
  if (locale !== "en" && byKey.size > 0) {
    const translations = await listTranslationsForEntries(supabase, [...byKey.values()].map((e) => e.id), locale);
    for (const t of translations) translationByEntryId.set(t.entry_id, t.name);
  }

  const result = new Map<string, string>();
  for (const key of uniqueKeys) {
    const entry = byKey.get(key);
    if (entry) result.set(key, translationByEntryId.get(entry.id) ?? entryNameFrom(entry));
  }
  return result;
}

/**
 * Assemble une fiche de regle complete pour l'affichage : resout le
 * ruleset du monde, trouve l'entree, valide chaque bloc via son schema
 * (le moteur ne recoit jamais une forme non garantie), engendre la table
 * du bloc scaling a partir de sa regle quand il en a une, calcule les
 * colonnes formule d'un class_progression, et signale les blocs requis
 * manquants sans jamais rejeter l'entree (specs/regles-blocs.md §5-§7).
 */
export async function getRuleEntryForWorld(
  supabase: TypedClient,
  worldId: string,
  entryKey: string,
  locale: Locale
): Promise<RuleEntryDetail | null> {
  const rulesetId = await getWorldDefaultRulesetId(supabase, worldId);
  if (!rulesetId) return null;

  const chain = await walkRulesetChain(supabase, rulesetId);

  let entry: RulesetEntryRow | null = null;
  for (const link of chain) {
    entry = await getRulesetEntryByKey(supabase, link.rulesetId, entryKey);
    if (entry) break;
  }

  // L'anglais est deja la langue source (source_raw.name) : aucune
  // recherche de traduction n'est necessaire pour cette locale. Une fiche
  // maison (V1-D4, `entry` absent de toute base de la chaine) n'a par
  // definition ni traduction ni bloc en base — son contenu voyage entier
  // dans les surcharges collectees plus bas.
  const translation = entry && locale !== "en" ? await getEntryTranslation(supabase, entry.id, locale) : null;
  const blockRows = entry ? await listBlocksForRulesetEntry(supabase, entry.id) : [];
  // Surcharges de traduction par block_type (V1-A5, ex: description) : posees
  // sur la base AVANT resolution des surcharges de variante, pour qu'une
  // surcharge de variante (ecrite par un MJ, potentiellement dans une autre
  // langue) l'emporte toujours si elle vise le meme bloc.
  const translatedBlocks = (translation?.blocks ?? {}) as Record<string, unknown>;
  const baseEntry: ResolvableEntry | null = entry
    ? {
        entry_key: entry.entry_key,
        entry_type: entry.entry_type,
        blocks: blockRows.map(
          (row): ResolvableBlock => ({
            block_type: row.block_type,
            display: row.display,
            data: translatedBlocks[row.block_type] ?? row.data,
            display_order: row.display_order,
          })
        ),
      }
    : null;

  // Surcharges collectees racine -> feuille (chain est feuille -> racine) :
  // la variante la plus specifique s'applique en dernier (SCHEMA.md §9.4).
  // `add_entry` porte une charge utile courte (`zAddEntryPayload` : nom +
  // type, V1-D4) — traduite ici en la forme `ResolvableEntry` complete
  // (cle + type + blocs vides, les blocs arrivent par des `add_block`
  // separes) qu'attend `applyOverrides`, pour que le coeur pur reste
  // ignorant de ce detail d'encodage.
  const overrides: OverrideInput[] = [];
  let homebrewName: string | null = null;
  // V1-D5, specs/ruleset-personnel.md : le badge "reference personnelle" ne
  // marque que les fiches reellement touchees par une surcharge d'un niveau
  // personal_reference — jamais une fiche purement heritee de la base
  // officielle qu'on regarde "a travers" une telle variante (une variante
  // personal_reference peut tres bien ne rien surcharger sur telle entree).
  let personalReference = false;
  for (const link of [...chain].reverse()) {
    const rows = await listOverridesForRuleset(supabase, link.rulesetId, entryKey);
    if (rows.length > 0 && link.contentOrigin === "personal_reference") personalReference = true;
    for (const row of rows) {
      if (row.action === "add_entry") {
        const addEntry = zAddEntryPayload.parse(row.payload);
        homebrewName = addEntry.name;
        overrides.push({
          block_type: null,
          action: "add_entry",
          payload: { entry_key: entryKey, entry_type: addEntry.entry_type, blocks: [] } satisfies ResolvableEntry,
          patch: null,
        });
        continue;
      }
      overrides.push({
        block_type: row.block_type,
        action: row.action as OverrideInput["action"],
        payload: row.payload,
        patch: row.patch,
      });
    }
  }

  const resolved = applyOverrides(baseEntry, overrides);
  // Desactivee dans cette variante : traitee comme absente, pas comme une erreur.
  // Ni base ni `add_entry` : la fiche n'existe simplement pas.
  if (!resolved || resolved.disabled) return null;

  // id stable pour l'affichage (cle React) : celui de la ligne d'origine
  // quand elle existe encore, sinon un id synthetique (bloc introduit par
  // une surcharge add_block/replace_block sans ligne source).
  const originalIdByBlockType = new Map(blockRows.map((row) => [row.block_type, row.id]));
  // Donnee avant surcharge de variante, pour le badge "modifiee" + comparaison
  // (V1-A4) — depuis baseEntry (deja traduite si une traduction existe,
  // V1-A5), pas les lignes brutes anglaises : la comparaison doit rester
  // dans la meme langue des deux cotes, seule la surcharge de variante doit
  // faire la difference. Vide pour une fiche maison : rien a comparer, elle
  // n'a pas d'"avant".
  const originalDataByBlockType = new Map((baseEntry?.blocks ?? []).map((b) => [b.block_type, b.data]));

  const validated = resolved.blocks.map((block) => ({
    id: originalIdByBlockType.get(block.block_type) ?? `override:${block.block_type}`,
    blockType: block.block_type as BlockType,
    data: dataSchemaForBlockType(block.block_type as BlockType).parse(block.data),
    displayOrder: block.display_order,
    rawDisplay: block.display,
    originalData: resolved.modifiedBlockTypes.includes(block.block_type)
      ? originalDataByBlockType.get(block.block_type)
      : undefined,
  }));

  const effectsData = validated.find((b) => b.blockType === "effects")?.data as
    | EffectsBlockData
    | undefined;

  const blocks: RuleEntryBlockView[] = validated.map(({ id, blockType, data, displayOrder, rawDisplay, originalData }) => {
    const display = zBlockDisplay.parse(rawDisplay);

    if (blockType === "scaling") {
      const scalingData = data as ScalingBlockData;
      const baseFormula = scalingData.rule
        ? resolveScalingTarget(scalingData.rule.target, effectsData)
        : undefined;
      const table = generateScalingTable(scalingData, maxLevelForAxis(scalingData.axis), baseFormula);
      return { id, blockType, display, data: { ...scalingData, table }, displayOrder, originalData };
    }

    if (blockType === "class_progression") {
      const progressionData = data as ClassProgressionBlockData;
      return {
        id,
        blockType,
        display,
        data: { ...progressionData, rows: computeProgressionRows(progressionData) },
        displayOrder,
        originalData,
      };
    }

    return { id, blockType, display, data, displayOrder, originalData };
  });

  // Le SRD porte les PX de chaque monstre (`source_raw.xp`), mais
  // l'extraction initiale du bloc `stat_block` (V1-D3b) ne l'a jamais copie
  // dans ses donnees — retour utilisateur : injecte a la lecture, jamais un
  // backfill des lignes stockees, jamais une valeur inventee si absente de
  // la source (monstres sans XP dans le SRD, rares mais existants).
  if (entry?.entry_type === "monster") {
    const rawXp = (entry.source_raw as { xp?: unknown } | null)?.xp;
    if (typeof rawXp === "number") {
      const statBlock = blocks.find((b) => b.blockType === "stat_block");
      if (statBlock) statBlock.data = { ...(statBlock.data as StatBlockBlockData), xp: rawXp };
    }
  }

  // Une fiche maison n'a pas de `ruleset_entry_refs` (la table exige un
  // `source_entry_id` reel) : aucun renvoi sortant deduit pour elle, mais
  // elle peut toujours etre visee par le renvoi ENTRANT d'une autre fiche
  // (`resolveIncomingRefs` ne prend qu'une cle, jamais un id).
  const [outgoingRefs, incomingRefs] = await Promise.all([
    entry ? resolveOutgoingRefs(supabase, rulesetId, entry.id, locale) : Promise.resolve([]),
    resolveIncomingRefs(supabase, rulesetId, entryKey, locale),
  ]);

  // Augmente le bloc `background` avec le nom+description de son don et le
  // nom de chaque objet d'equipement reference (V1-D7) — cf.
  // ResolvedBackgroundBlockData, meme motif que `scaling`/`class_progression`
  // ci-dessus (donnee calculee a la lecture, ajoutee a la forme validee).
  const backgroundBlockIndex = blocks.findIndex((b) => b.blockType === "background");
  if (backgroundBlockIndex !== -1) {
    const bgData = blocks[backgroundBlockIndex].data as BackgroundBlockData;
    const itemKeys = bgData.equipment_options.flatMap((opt) => opt.items.flatMap((it) => (it.ref ? [it.ref.key] : [])));
    const [featDetail, itemNames] = await Promise.all([
      resolveEntryDetail(supabase, rulesetId, bgData.feat.key, locale),
      resolveEntryNames(supabase, rulesetId, itemKeys, locale),
    ]);
    blocks[backgroundBlockIndex] = {
      ...blocks[backgroundBlockIndex],
      data: {
        ...bgData,
        feat_name: featDetail?.name ?? bgData.feat.key,
        feat_description: featDetail?.description ?? "",
        equipment_options: bgData.equipment_options.map((opt) => ({
          ...opt,
          items: opt.items.map((it) => ({ ...it, resolved_label: it.ref ? (itemNames.get(it.ref.key) ?? it.label) : it.label })),
        })),
      } satisfies ResolvedBackgroundBlockData,
    };
  }

  // Augmente le bloc `class_equipment` avec le nom de chaque objet
  // reference (V2-G1, point 9) — meme motif exact que `background`
  // ci-dessus, sur `fixed` ET chaque `choices[].options[]`.
  const classEquipmentBlockIndex = blocks.findIndex((b) => b.blockType === "class_equipment");
  if (classEquipmentBlockIndex !== -1) {
    const ceData = blocks[classEquipmentBlockIndex].data as ClassEquipmentBlockData;
    const itemKeys = [
      ...ceData.fixed.flatMap((it) => (it.ref ? [it.ref.key] : [])),
      ...ceData.choices.flatMap((c) => c.options.flatMap((opt) => opt.items.flatMap((it) => (it.ref ? [it.ref.key] : [])))),
    ];
    const itemNames = await resolveEntryNames(supabase, rulesetId, itemKeys, locale);
    const resolveItem = (it: BackgroundEquipmentItem) => ({
      ...it,
      resolved_label: it.ref ? (itemNames.get(it.ref.key) ?? it.label) : it.label,
    });
    blocks[classEquipmentBlockIndex] = {
      ...blocks[classEquipmentBlockIndex],
      data: {
        fixed: ceData.fixed.map(resolveItem),
        choices: ceData.choices.map((c) => ({ options: c.options.map((opt) => ({ ...opt, items: opt.items.map(resolveItem) })) })),
      } satisfies ResolvedClassEquipmentBlockData,
    };
  }

  // Augmente le bloc `subclass_slot` avec le nom resolu de chaque option
  // (V1-D7, retour utilisateur : le lien affichait la cle technique brute,
  // ex. "evoker") — meme motif que `background` ci-dessus.
  const subclassSlotBlockIndex = blocks.findIndex((b) => b.blockType === "subclass_slot");
  if (subclassSlotBlockIndex !== -1) {
    const slotData = blocks[subclassSlotBlockIndex].data as SubclassSlotBlockData;
    const optionKeys = slotData.options?.map((o) => o.key) ?? [];
    const optionNames = await resolveEntryNames(supabase, rulesetId, optionKeys, locale);
    blocks[subclassSlotBlockIndex] = {
      ...blocks[subclassSlotBlockIndex],
      data: {
        ...slotData,
        options: slotData.options?.map((o) => ({ ...o, resolved_name: optionNames.get(o.key) ?? o.key })),
      } satisfies ResolvedSubclassSlotBlockData,
    };
  }

  // Augmente le bloc `weapon` avec le nom ET le texte de chaque propriete et
  // de la botte d'arme (V1-D7, retour utilisateur : d'abord un lien, puis
  // "il faut que ca soit directement visible sur la fiche", meme niveau de
  // detail que le Don d'un `background` ci-dessus).
  const weaponBlockIndex = blocks.findIndex((b) => b.blockType === "weapon");
  if (weaponBlockIndex !== -1) {
    const weaponData = blocks[weaponBlockIndex].data as WeaponBlockData;
    const propertyKeys = weaponData.properties.map((p) => p.key);
    const keysToResolve = weaponData.mastery ? [...propertyKeys, weaponData.mastery.key] : propertyKeys;
    const details = await resolveEntryDetails(supabase, rulesetId, keysToResolve, locale);
    blocks[weaponBlockIndex] = {
      ...blocks[weaponBlockIndex],
      data: {
        ...weaponData,
        properties: weaponData.properties.map((p) => ({
          ...p,
          resolved_name: details.get(p.key)?.name ?? p.key,
          resolved_description: details.get(p.key)?.description ?? "",
        })),
        mastery: weaponData.mastery
          ? {
              ...weaponData.mastery,
              resolved_name: details.get(weaponData.mastery.key)?.name ?? weaponData.mastery.key,
              resolved_description: details.get(weaponData.mastery.key)?.description ?? "",
            }
          : undefined,
      } satisfies ResolvedWeaponBlockData,
    };
  }

  // Augmente le bloc `species_traits` avec le nom ET le texte de chaque
  // trait (V1-D7, retour utilisateur : "botte et caracteristiques... un
  // bloc comme pour Don") — meme motif que `weapon` ci-dessus, applique des
  // le depart a la description plutot qu'au seul nom.
  const speciesTraitsBlockIndex = blocks.findIndex((b) => b.blockType === "species_traits");
  if (speciesTraitsBlockIndex !== -1) {
    const traitsData = blocks[speciesTraitsBlockIndex].data as SpeciesTraitsBlockData;
    const details = await resolveEntryDetails(
      supabase,
      rulesetId,
      traitsData.traits.map((t) => t.key),
      locale
    );
    blocks[speciesTraitsBlockIndex] = {
      ...blocks[speciesTraitsBlockIndex],
      data: {
        ...traitsData,
        traits: traitsData.traits.map((t) => ({
          ...t,
          resolved_name: details.get(t.key)?.name ?? t.key,
          resolved_description: details.get(t.key)?.description ?? "",
        })),
      } satisfies ResolvedSpeciesTraitsBlockData,
    };
  }

  // Augmente le bloc `item_properties` avec le nom resolu de chaque objet
  // d'un paquetage (V1-D7, passe Objet) — meme motif que
  // `background.equipment_options` ci-dessus, seul le nom est necessaire.
  const itemPropertiesBlockIndex = blocks.findIndex((b) => b.blockType === "item_properties");
  if (itemPropertiesBlockIndex !== -1) {
    const itemData = blocks[itemPropertiesBlockIndex].data as ItemPropertiesBlockData;
    const contentKeys = itemData.contents?.flatMap((c) => (c.ref ? [c.ref.key] : [])) ?? [];
    const contentNames = await resolveEntryNames(supabase, rulesetId, contentKeys, locale);
    blocks[itemPropertiesBlockIndex] = {
      ...blocks[itemPropertiesBlockIndex],
      data: {
        ...itemData,
        contents: itemData.contents?.map((c) => ({ ...c, resolved_label: c.ref ? (contentNames.get(c.ref.key) ?? c.label) : c.label })),
      } satisfies ResolvedItemPropertiesBlockData,
    };
  }

  // `entry` peut etre absent (fiche maison, V1-D4) : `resolved` porte alors
  // le type resolu depuis la charge utile `add_entry`, et `homebrewName` son
  // nom (aucun des deux ne passe par `entryNameFrom`/la table de traduction,
  // qui exigent tous deux une ligne `ruleset_entries` reelle).
  return {
    id: entry?.id ?? entryKey,
    entryKey,
    entryType: resolved.entry_type as EntryType,
    name: entry ? (translation?.name ?? entryNameFrom(entry)) : (homebrewName ?? entryKey),
    sourceAttribution: entry?.source_attribution ?? null,
    blocks,
    missingBlocks: missingRequiredBlocks(
      resolved.entry_type as EntryType,
      resolved.blocks.map((b) => b.block_type)
    ),
    outgoingRefs,
    incomingRefs,
    modifiedBlockTypes: resolved.modifiedBlockTypes,
    personalReference,
  };
}

export interface RuleEntrySummary {
  key: string;
  entryType: EntryType;
  name: string;
  /**
   * Cle de la classe parente, pour `entryType === "subclass"` (V1-C4 suite,
   * filtrage sous-classe/classe) ou `entryType === "feature"` (ticket #57,
   * sur retour utilisateur : desambiguer les aptitudes homonymes dans la
   * sidebar — sept classes ont chacune leur propre "Sorts", une quinzaine
   * partagent "Amélioration de caractéristique"). Jamais utilisé pour nicher
   * les Aptitudes sous leur classe comme les sous-classes : la sidebar
   * s'en sert seulement pour afficher un suffixe de classe sur les noms en
   * double. `undefined` si la source ne porte pas ce champ (dons, propriétés
   * d'arme, traits d'espèce... aucun lien de classe).
   */
  parentClassKey?: string;
  /**
   * Cle de l'espece parente (V1-D7, retour utilisateur : nicher les
   * sous-especes sous leur espece dans la sidebar, meme motif que
   * `parentClassKey`). Difference cle avec Classe/Sous-classe : la 5.2.1 ne
   * porte pas d'`entry_type` distinct pour les sous-especes — une ascendance
   * draconique, une lignee elfique... sont `entry_type: "species"` au meme
   * titre que l'espece elle-meme, seule la presence de ce champ les distingue.
   */
  parentSpeciesKey?: string;
}

/** Lit `source_raw.class.index` (forme SRD des sous-classes, verifiee en base : `{"class":{"index":"wizard",...}}`) — tolerant, jamais d'exception si la forme differe (contenu importe autrement). */
function subclassParentClassKey(sourceRaw: unknown): string | undefined {
  if (!sourceRaw || typeof sourceRaw !== "object") return undefined;
  const cls = (sourceRaw as Record<string, unknown>).class;
  if (!cls || typeof cls !== "object") return undefined;
  const index = (cls as Record<string, unknown>).index;
  return typeof index === "string" ? index : undefined;
}

/**
 * Lit `source_raw.species.index` (SRD 2024, "Subspecies" -> `{"species":
 * {"index":"dragonborn",...}}`) OU `source_raw.race.index` (SRD 2014,
 * "Subraces" -> `{"race":{"index":"dwarf",...}}`, bug reel trouve en
 * verifiant l'assistant : "Nain des collines" remontait comme espece de
 * base independante, jamais nichee sous "Nain", car cette fonction ne
 * lisait que la forme 2024) — meme tolerance que `subclassParentClassKey`.
 */
function speciesParentKey(sourceRaw: unknown): string | undefined {
  if (!sourceRaw || typeof sourceRaw !== "object") return undefined;
  const record = sourceRaw as Record<string, unknown>;
  const parent = record.species ?? record.race;
  if (!parent || typeof parent !== "object") return undefined;
  const index = (parent as Record<string, unknown>).index;
  return typeof index === "string" ? index : undefined;
}

/**
 * Meme remontee que findEntryInRulesetChain, mais pour lister plutot que
 * chercher une cle : s'arrete au premier ruleset de la chaine qui a des
 * entrees a lui (un monde variante sans rien a soi remonte jusqu'a son
 * ancetre officiel). Les surcharges `add_entry`/`disable_entry` de CHAQUE
 * niveau traverse (V1-D4) sont collectees au passage puis fusionnees une
 * fois la base atteinte via `mergeHomebrewEntries` — une fiche maison n'a
 * de sens qu'a la fusion : elle n'a par definition pas de fiche de base
 * correspondante, seul son entry_key/entry_type/name portes par la
 * surcharge elle-meme la decrivent.
 */
async function listEntriesInRulesetChain(
  supabase: TypedClient,
  rulesetId: string,
  locale: Locale
): Promise<RuleEntrySummary[]> {
  let currentId: string | null = rulesetId;
  const homebrewEntries: RuleEntrySummary[] = [];
  const disabledKeys = new Set<string>();

  for (let hop = 0; currentId && hop < MAX_RULESET_CHAIN_DEPTH; hop++) {
    const levelOverrides = await listEntryLevelOverridesForRuleset(supabase, currentId);
    for (const ov of levelOverrides) {
      if (ov.action === "disable_entry") {
        disabledKeys.add(ov.entry_key);
      } else if (ov.action === "add_entry") {
        const payload = zAddEntryPayload.parse(ov.payload);
        homebrewEntries.push({ key: ov.entry_key, entryType: payload.entry_type as EntryType, name: payload.name });
      }
    }

    const entries = await listRulesetEntries(supabase, currentId);
    if (entries.length > 0) {
      const translationByEntryId = new Map<string, string>();
      if (locale !== "en") {
        const translations = await listTranslationsForEntries(supabase, entries.map((e) => e.id), locale);
        for (const t of translations) translationByEntryId.set(t.entry_id, t.name);
      }
      const baseSummaries = entries.map((e) => ({
        key: e.entry_key,
        entryType: e.entry_type as EntryType,
        name: translationByEntryId.get(e.id) ?? entryNameFrom(e),
        parentClassKey:
          e.entry_type === "subclass" || e.entry_type === "feature" ? subclassParentClassKey(e.source_raw) : undefined,
        parentSpeciesKey: e.entry_type === "species" ? speciesParentKey(e.source_raw) : undefined,
      }));
      return mergeHomebrewEntries(baseSummaries, homebrewEntries, disabledKeys);
    }
    const ruleset = await getRulesetById(supabase, currentId);
    currentId = ruleset?.parent_ruleset_id ?? null;
  }
  return mergeHomebrewEntries([], homebrewEntries, disabledKeys);
}

/** Barre laterale de l'onglet Regles : `null` si le monde est introuvable, liste vide si aucun ruleset n'est assigne. */
export async function listRuleEntriesForWorld(
  supabase: TypedClient,
  worldSlug: string,
  locale: Locale
): Promise<RuleEntrySummary[] | null> {
  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) return null;
  const rulesetId = await getWorldDefaultRulesetId(supabase, world.id);
  if (!rulesetId) return [];
  return listEntriesInRulesetChain(supabase, rulesetId, locale);
}

export interface RawRuleEntryBlock {
  blockType: string;
  data: unknown;
}

/**
 * Blocs bruts (assistant de creation de personnage, V2-G1 suite) pour un LOT
 * de cles — jamais une par une via `getRuleEntryForWorld`/`getRuleEntryPageData`,
 * qui refont chacune tout le travail (monde, chaine de rulesets, entree,
 * traduction, blocs) depuis zero. Bug reel trouve en verifiant l'etape
 * Sorts : la liste candidate (jusqu'a 339 sorts) prenait plusieurs secondes,
 * chaque cle valant une demi-douzaine d'allers-retours DB independants.
 *
 * Simplification assumee par rapport a `getRuleEntryForWorld` : les
 * surcharges de variante (`ruleset_entry_overrides`, V1-A4) ne sont PAS
 * appliquees ici. Cet endpoint sert uniquement l'assistant, un outil
 * d'aide au choix pendant la creation — la fiche reelle de l'entite creee
 * ne passe jamais par ce chemin, elle referme la cle choisie et la resout
 * normalement (overrides inclus) partout ailleurs dans l'app. Un sort
 * dont le texte est surcharge par une variante maison montrerait donc le
 * texte officiel pendant le choix, jamais dans le personnage cree.
 */
/**
 * `resolveEntryNames`/`resolveEntryDetails` fusionnes puis rendus batches
 * (V2-G1 suite, retour utilisateur : les fiches de l'assistant montraient
 * "undefined" a la place du nom d'un trait, d'une option de sous-classe ou
 * d'un objet d'equipement resolu depuis une reference). Meme chaine de
 * rulesets que `listRuleEntryBlocksByKeys` ci-dessous, mais parcourue UNE
 * fois pour tout le lot de cles referencees plutot qu'un aller-retour par
 * cle (`resolveEntryDetail` fait ce dernier, tolerable pour les 1 a 10 cles
 * d'une seule fiche via `getRuleEntryForWorld`, pas pour le batch entier de
 * l'assistant).
 */
async function resolveNamesAndDescriptionsBatched(
  supabase: TypedClient,
  rulesetId: string,
  keys: string[],
  locale: Locale
): Promise<Map<string, { name: string; description: string }>> {
  const result = new Map<string, { name: string; description: string }>();
  const remaining = new Set(keys);
  if (remaining.size === 0) return result;

  const chain = await walkRulesetChain(supabase, rulesetId);

  for (const link of chain) {
    if (remaining.size === 0) break;
    const entries = await listRulesetEntriesByKeys(supabase, link.rulesetId, [...remaining]);
    if (entries.length === 0) continue;

    const entryIds = entries.map((e) => e.id);
    const [blockRows, translations] = await Promise.all([
      listBlocksForRulesetEntries(supabase, entryIds),
      locale !== "en" ? listEntryTranslationsWithBlocks(supabase, entryIds, locale) : Promise.resolve([]),
    ]);

    const translationByEntryId = new Map(translations.map((t) => [t.entry_id, t]));
    const descriptionRowByEntryId = new Map(
      blockRows.filter((r) => r.block_type === "description").map((r) => [r.entry_id, r.data])
    );

    for (const entry of entries) {
      const translation = translationByEntryId.get(entry.id);
      const name = translation?.name ?? entryNameFrom(entry);
      const overrideDescription = (translation?.blocks as Record<string, unknown> | undefined)?.description;
      const rawDescription = overrideDescription ?? descriptionRowByEntryId.get(entry.id);
      const segments = (rawDescription as { segments?: { text: string }[] } | undefined)?.segments;
      result.set(entry.entry_key, { name, description: segments?.map((s) => s.text).join("\n\n") ?? "" });
      remaining.delete(entry.entry_key);
    }
  }

  return result;
}

export async function listRuleEntryBlocksByKeys(
  supabase: TypedClient,
  worldId: string,
  entryKeys: string[],
  locale: Locale
): Promise<Record<string, RawRuleEntryBlock[]>> {
  const result: Record<string, RawRuleEntryBlock[]> = {};
  const rulesetId = await getWorldDefaultRulesetId(supabase, worldId);
  if (!rulesetId) return result;

  const chain = await walkRulesetChain(supabase, rulesetId);
  const remaining = new Set(entryKeys);

  for (const link of chain) {
    if (remaining.size === 0) break;
    const entries = await listRulesetEntriesByKeys(supabase, link.rulesetId, [...remaining]);
    if (entries.length === 0) continue;

    const entryIds = entries.map((e) => e.id);
    const [blockRows, translations] = await Promise.all([
      listBlocksForRulesetEntries(supabase, entryIds),
      locale !== "en" ? listEntryTranslationsWithBlocks(supabase, entryIds, locale) : Promise.resolve([]),
    ]);

    const translationByEntryId = new Map(translations.map((t) => [t.entry_id, (t.blocks ?? {}) as Record<string, unknown>]));
    const blocksByEntryId = new Map<string, RawRuleEntryBlock[]>();
    for (const row of blockRows) {
      const overrides = translationByEntryId.get(row.entry_id) ?? {};
      const list = blocksByEntryId.get(row.entry_id) ?? [];
      list.push({ blockType: row.block_type, data: overrides[row.block_type] ?? row.data });
      blocksByEntryId.set(row.entry_id, list);
    }

    for (const entry of entries) {
      result[entry.entry_key] = blocksByEntryId.get(entry.id) ?? [];
      remaining.delete(entry.entry_key);
    }
  }

  // Deuxieme passe : resout les references internes que certains blocs
  // portent comme simple cle technique (don d'un historique, options d'une
  // sous-classe, proprietes/botte d'une arme, traits d'une espece, contenu
  // d'un paquetage) — memes "Resolved*BlockData" que `getRuleEntryForWorld`,
  // en un seul lot pour tout le batch plutot qu'un aller-retour par entree.
  // Bug reel corrige ici : sans cette passe, ces champs restaient absents
  // et `blockContentRenderer.tsx` affichait litteralement "undefined" a la
  // place du nom (`ResolvedRefLink`), ou une description vide.
  const refKeys = new Set<string>();
  for (const blocks of Object.values(result)) {
    for (const block of blocks) {
      if (block.blockType === "background") {
        const data = block.data as BackgroundBlockData;
        refKeys.add(data.feat.key);
        for (const opt of data.equipment_options) for (const it of opt.items) if (it.ref) refKeys.add(it.ref.key);
      } else if (block.blockType === "subclass_slot") {
        const data = block.data as SubclassSlotBlockData;
        for (const o of data.options ?? []) refKeys.add(o.key);
      } else if (block.blockType === "weapon") {
        const data = block.data as WeaponBlockData;
        for (const p of data.properties) refKeys.add(p.key);
        if (data.mastery) refKeys.add(data.mastery.key);
      } else if (block.blockType === "species_traits") {
        const data = block.data as SpeciesTraitsBlockData;
        for (const t of data.traits) refKeys.add(t.key);
      } else if (block.blockType === "item_properties") {
        const data = block.data as ItemPropertiesBlockData;
        for (const c of data.contents ?? []) if (c.ref) refKeys.add(c.ref.key);
      } else if (block.blockType === "class_equipment") {
        const data = block.data as ClassEquipmentBlockData;
        for (const it of data.fixed) if (it.ref) refKeys.add(it.ref.key);
        for (const c of data.choices) for (const opt of c.options) for (const it of opt.items) if (it.ref) refKeys.add(it.ref.key);
      }
    }
  }

  if (refKeys.size > 0) {
    const resolved = await resolveNamesAndDescriptionsBatched(supabase, rulesetId, [...refKeys], locale);
    for (const blocks of Object.values(result)) {
      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        if (block.blockType === "background") {
          const data = block.data as BackgroundBlockData;
          blocks[i] = {
            ...block,
            data: {
              ...data,
              feat_name: resolved.get(data.feat.key)?.name ?? data.feat.key,
              feat_description: resolved.get(data.feat.key)?.description ?? "",
              equipment_options: data.equipment_options.map((opt) => ({
                ...opt,
                items: opt.items.map((it) => ({
                  ...it,
                  resolved_label: it.ref ? (resolved.get(it.ref.key)?.name ?? it.label) : it.label,
                })),
              })),
            } satisfies ResolvedBackgroundBlockData,
          };
        } else if (block.blockType === "subclass_slot") {
          const data = block.data as SubclassSlotBlockData;
          blocks[i] = {
            ...block,
            data: {
              ...data,
              options: data.options?.map((o) => ({ ...o, resolved_name: resolved.get(o.key)?.name ?? o.key })),
            } satisfies ResolvedSubclassSlotBlockData,
          };
        } else if (block.blockType === "weapon") {
          const data = block.data as WeaponBlockData;
          blocks[i] = {
            ...block,
            data: {
              ...data,
              properties: data.properties.map((p) => ({
                ...p,
                resolved_name: resolved.get(p.key)?.name ?? p.key,
                resolved_description: resolved.get(p.key)?.description ?? "",
              })),
              mastery: data.mastery
                ? {
                    ...data.mastery,
                    resolved_name: resolved.get(data.mastery.key)?.name ?? data.mastery.key,
                    resolved_description: resolved.get(data.mastery.key)?.description ?? "",
                  }
                : undefined,
            } satisfies ResolvedWeaponBlockData,
          };
        } else if (block.blockType === "species_traits") {
          const data = block.data as SpeciesTraitsBlockData;
          blocks[i] = {
            ...block,
            data: {
              ...data,
              traits: data.traits.map((t) => ({
                ...t,
                resolved_name: resolved.get(t.key)?.name ?? t.key,
                resolved_description: resolved.get(t.key)?.description ?? "",
              })),
            } satisfies ResolvedSpeciesTraitsBlockData,
          };
        } else if (block.blockType === "item_properties") {
          const data = block.data as ItemPropertiesBlockData;
          blocks[i] = {
            ...block,
            data: {
              ...data,
              contents: data.contents?.map((c) => ({
                ...c,
                resolved_label: c.ref ? (resolved.get(c.ref.key)?.name ?? c.label) : c.label,
              })),
            } satisfies ResolvedItemPropertiesBlockData,
          };
        } else if (block.blockType === "class_equipment") {
          const data = block.data as ClassEquipmentBlockData;
          const resolveItem = (it: BackgroundEquipmentItem) => ({
            ...it,
            resolved_label: it.ref ? (resolved.get(it.ref.key)?.name ?? it.label) : it.label,
          });
          blocks[i] = {
            ...block,
            data: {
              fixed: data.fixed.map(resolveItem),
              choices: data.choices.map((c) => ({ options: c.options.map((opt) => ({ ...opt, items: opt.items.map(resolveItem) })) })),
            } satisfies ResolvedClassEquipmentBlockData,
          };
        }
      }
    }
  }

  return result;
}

/** Composition pour la route `/m/[worldSlug]/regles/[cle]` : `null` si le monde ou la regle sont introuvables — la page traduit ça en 404. */
export async function getRuleEntryPageData(
  supabase: TypedClient,
  worldSlug: string,
  entryKey: string,
  locale: Locale
): Promise<RuleEntryDetail | null> {
  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) return null;
  return getRuleEntryForWorld(supabase, world.id, entryKey, locale);
}

// --- Selection du ruleset actif (V1-C5) ---------------------------------

/** `null` si personne n'est authentifie — l'appelant (route) traduit ça en 401 plutot que de renvoyer une liste vide trompeuse. */
export async function listSelectableRulesetsForCurrentUser(supabase: TypedClient): Promise<SelectableRulesetRow[] | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return listSelectableRulesets(supabase, user.id);
}

/**
 * Change le ruleset actif d'un monde. `false` si le monde est introuvable,
 * si le ruleset cible n'est pas lisible par l'appelant (RLS sur la lecture
 * de `rulesets`), ou si l'appelant n'est pas le proprietaire du monde (RLS
 * sur l'ecriture de `worlds` — `setWorldDefaultRuleset` renvoie alors
 * `updated: false` plutot qu'une erreur).
 */
export async function setActiveRuleset(supabase: TypedClient, worldSlug: string, rulesetId: string): Promise<boolean> {
  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) return false;
  const ruleset = await getRulesetById(supabase, rulesetId);
  if (!ruleset) return false;
  const { updated } = await setWorldDefaultRuleset(supabase, world.id, rulesetId);
  return updated;
}

/**
 * Cree une variante vierge a partir d'un ruleset officiel (V1-C5) : aucune
 * surcharge propre pour l'instant, la chaine de resolution (V1-A4) fait
 * remonter chaque entree jusqu'a l'officiel tant que rien ne la surcharge —
 * un MJ peut donc commencer a jouer avec sa variante des sa creation, puis
 * l'editer entree par entree plus tard (V1-D2).
 *
 * `personalReference` (V1-D5, specs/ruleset-personnel.md §2) : pose
 * `content_origin = 'personal_reference'` plutot que `user_created` —
 * verrouille en base des la creation (aucune bascule possible ensuite,
 * migration 20260817130001). Exige un parent officiel, jamais une autre
 * variante : "un ruleset personnel derivant d'une base SRD" (§4.1), pas
 * une reference imbriquee dans une regle maison.
 */
export async function createRulesetVariant(
  supabase: TypedClient,
  params: { name: string; parentRulesetId: string; personalReference?: boolean }
): Promise<{ id: string } | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const parent = await getRulesetById(supabase, params.parentRulesetId);
  if (!parent) return null;
  if (params.personalReference && !parent.is_official_base) return null;
  return insertRulesetVariant(supabase, {
    name: params.name,
    baseSystem: parent.base_system,
    parentRulesetId: parent.id,
    createdBy: user.id,
    contentOrigin: params.personalReference ? "personal_reference" : "user_created",
  });
}

/**
 * Supprime une variante — jamais un officiel (verifie explicitement en plus
 * de la RLS, qui l'interdirait de toute facon via `created_by = auth.uid()`
 * puisqu'un officiel n'a pas de createur : demande utilisateur au pied de
 * la lettre, « un bouton de suppression pour les regles autres que srd 5.1
 * et 5.2 »).
 */
export async function deleteRulesetVariant(supabase: TypedClient, rulesetId: string): Promise<DeleteRulesetOutcome> {
  const ruleset = await getRulesetById(supabase, rulesetId);
  if (!ruleset || ruleset.is_official_base) return "not_found";
  return deleteRuleset(supabase, rulesetId);
}

const zCreateHomebrewWeaponInput = z.object({
  rulesetId: z.string().uuid(),
  name: z.string().min(1),
  weapon: zWeaponBlockData,
  note: z.string().min(1).optional(),
});
export type CreateHomebrewWeaponInput = z.infer<typeof zCreateHomebrewWeaponInput>;

/**
 * Cree une arme maison (V1-D4) : deux surcharges dans le meme ruleset,
 * l'`add_entry` qui fait exister la fiche (nom + entry_type, forme
 * `AddEntryPayload`) puis l'`add_block` qui lui donne son bloc `weapon`
 * (meme enveloppe que l'import SRD — `weaponBlock` dans
 * `scripts/ingest-srd.ts`). Seul type de fiche en portee pour ce ticket :
 * un formulaire dedie par type de bloc plutot qu'un moteur generique
 * (regle des trois), la fonction porte donc son nom plutot qu'un
 * `blockType` en parametre.
 *
 * La cle est deduite du nom (`slugify`) et desambiguee si necessaire
 * contre TOUTE la chaine de ruleset, pas seulement ce niveau : une cle qui
 * collisionnerait avec une entree heritee masquerait silencieusement
 * l'entree de base au lieu de creer une nouvelle fiche a cote.
 */
export async function createHomebrewWeapon(
  supabase: TypedClient,
  input: CreateHomebrewWeaponInput
): Promise<{ entryKey: string; rulesetId: string }> {
  const parsed = zCreateHomebrewWeaponInput.parse(input);

  const existingKeys = new Set((await listEntriesInRulesetChain(supabase, parsed.rulesetId, "fr")).map((e) => e.key));
  const baseSlug = slugify(parsed.name);
  let entryKey = baseSlug;
  for (let attempt = 1; existingKeys.has(entryKey); attempt++) {
    entryKey = nextSlugCandidate(baseSlug, attempt);
  }

  const addEntryPayload: AddEntryPayload = zAddEntryPayload.parse({ name: parsed.name, entry_type: "weapon" });
  const rulesetIdAfterEntry = await upsertRulesetOverride(supabase, {
    rulesetId: parsed.rulesetId,
    entryKey,
    blockType: null,
    action: "add_entry",
    payload: addEntryPayload as unknown as Json,
    patch: null,
    note: parsed.note ?? null,
  });

  const weaponBlock: ResolvableBlock = {
    block_type: "weapon",
    display: { label: "Arme", layout: "key_values" },
    data: parsed.weapon,
    display_order: 150,
  };
  const rulesetIdAfterBlock = await upsertRulesetOverride(supabase, {
    // Reutilise l'id renvoye par le premier appel, pas parsed.rulesetId :
    // si le ruleset etait deja publie, le premier appel a fork une v+1 —
    // ce second appel doit viser cette meme nouvelle version, pas l'originale figee.
    rulesetId: rulesetIdAfterEntry,
    entryKey,
    blockType: "weapon",
    action: "add_block",
    payload: weaponBlock as unknown as Json,
    patch: null,
    note: parsed.note ?? null,
  });

  return { entryKey, rulesetId: rulesetIdAfterBlock };
}
