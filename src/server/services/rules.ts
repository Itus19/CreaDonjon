import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import {
  dataSchemaForBlockType,
  type BlockType,
  type ClassProgressionBlockData,
  type EffectsBlockData,
  type EntryType,
  type ScalingBlockData,
  zBlockDisplay,
} from "@/src/core/schemas/rule-blocks";
import { generateScalingTable, resolveScalingTarget } from "@/src/core/rules/scaling";
import { computeProgressionRows } from "@/src/core/rules/progression";
import { missingRequiredBlocks } from "@/src/core/rules/requiredBlocks";
import {
  applyOverrides,
  MAX_RULESET_CHAIN_DEPTH,
  RulesetChainCycleError,
  RulesetChainDepthError,
  type OverrideInput,
  type ResolvableBlock,
  type ResolvableEntry,
} from "@/src/core/rules/resolve";
import {
  getEntryTranslation,
  getRulesetById,
  getRulesetEntryByKey,
  listBlocksForRulesetEntry,
  listIncomingRefsForKey,
  listOutgoingRefs,
  listOverridesForRuleset,
  listRulesetEntries,
  listRulesetEntriesByKeys,
  listTranslationsForEntries,
  type RulesetEntryRow,
} from "@/src/server/repos/rules";
import { getWorldDefaultRulesetId } from "@/src/server/repos/worlds";
import { getWorldBySlug } from "@/src/server/services/worlds";
import type { Locale } from "@/src/i18n/request";

type TypedClient = SupabaseClient<Database>;

const SLOT_LEVEL_MAX = 9;
const CHARACTER_LEVEL_MAX = 20;

interface RulesetChainLink {
  rulesetId: string;
  parentRulesetId: string | null;
}

/**
 * Chaine de heritage d'un ruleset, du plus specifique (celui du monde) au
 * plus ancestral (l'officiel, en general) — feuille -> racine. Detection de
 * cycle explicite (V1-A4, SCHEMA.md §9.4) : un ensemble visite, pas
 * seulement la borne de profondeur, pour distinguer une vraie boucle
 * (erreur) d'une chaine simplement longue (erreur differente).
 */
async function walkRulesetChain(supabase: TypedClient, startRulesetId: string): Promise<RulesetChainLink[]> {
  const chain: RulesetChainLink[] = [];
  const visited = new Set<string>();
  let currentId: string | null = startRulesetId;

  while (currentId) {
    if (visited.has(currentId)) throw new RulesetChainCycleError(currentId);
    visited.add(currentId);
    if (chain.length >= MAX_RULESET_CHAIN_DEPTH) throw new RulesetChainDepthError();

    const ruleset = await getRulesetById(supabase, currentId);
    if (!ruleset) break;
    chain.push({ rulesetId: currentId, parentRulesetId: ruleset.parent_ruleset_id });
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
async function findEntryInRulesetChain(
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

export interface RuleEntryBlockView {
  id: string;
  blockType: BlockType;
  display: { label: string; layout: string; collapsed?: boolean };
  data: unknown;
  displayOrder: number;
  /** Donnee avant surcharge (V1-A4) — present seulement si ce bloc est dans modifiedBlockTypes, pour le badge "modifiee dans ta variante". */
  originalData?: unknown;
}

/** Un renvoi affiche (V1-A3) : `key` designe l'AUTRE entree — la cible pour un renvoi sortant, la source pour un renvoi entrant. `entryType` absent = renvoi non resolu (cible disparue ou jamais importee). */
export interface RuleRefView {
  key: string;
  name: string;
  entryType: EntryType | null;
  refKind: string;
  path: string | null;
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
}

function maxLevelForAxis(axis: ScalingBlockData["axis"]): number {
  return axis === "slot_level" ? SLOT_LEVEL_MAX : CHARACTER_LEVEL_MAX;
}

function entryNameFrom(entry: { entry_key: string; source_raw: unknown }): string {
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

  return refs.map((ref) => {
    const target = byKey.get(ref.target_key);
    return {
      key: ref.target_key,
      name: target ? (translationByEntryId.get(target.id) ?? entryNameFrom(target)) : ref.target_key,
      entryType: target ? (target.entry_type as EntryType) : null,
      refKind: ref.ref_kind,
      path: ref.path,
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
  if (!entry) return null;

  // L'anglais est deja la langue source (source_raw.name) : aucune
  // recherche de traduction n'est necessaire pour cette locale.
  const translation = locale !== "en" ? await getEntryTranslation(supabase, entry.id, locale) : null;

  const blockRows = await listBlocksForRulesetEntry(supabase, entry.id);
  const baseEntry: ResolvableEntry = {
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
  };

  // Surcharges collectees racine -> feuille (chain est feuille -> racine) :
  // la variante la plus specifique s'applique en dernier (SCHEMA.md §9.4).
  const overrides: OverrideInput[] = [];
  for (const link of [...chain].reverse()) {
    const rows = await listOverridesForRuleset(supabase, link.rulesetId, entryKey);
    for (const row of rows) {
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
  if (!resolved || resolved.disabled) return null;

  // id stable pour l'affichage (cle React) : celui de la ligne d'origine
  // quand elle existe encore, sinon un id synthetique (bloc introduit par
  // une surcharge add_block/replace_block sans ligne source).
  const originalIdByBlockType = new Map(blockRows.map((row) => [row.block_type, row.id]));
  // Donnee avant surcharge, pour le badge "modifiee" + comparaison (V1-A4) —
  // seulement necessaire pour les types effectivement touches.
  const originalDataByBlockType = new Map(blockRows.map((row) => [row.block_type, row.data]));

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

  const [outgoingRefs, incomingRefs] = await Promise.all([
    resolveOutgoingRefs(supabase, rulesetId, entry.id, locale),
    resolveIncomingRefs(supabase, rulesetId, entry.entry_key, locale),
  ]);

  return {
    id: entry.id,
    entryKey: entry.entry_key,
    entryType: entry.entry_type as EntryType,
    name: translation?.name ?? entryNameFrom(entry),
    sourceAttribution: entry.source_attribution,
    blocks,
    missingBlocks: missingRequiredBlocks(
      entry.entry_type as EntryType,
      resolved.blocks.map((b) => b.block_type)
    ),
    outgoingRefs,
    incomingRefs,
    modifiedBlockTypes: resolved.modifiedBlockTypes,
  };
}

export interface RuleEntrySummary {
  key: string;
  entryType: EntryType;
  name: string;
}

/**
 * Meme remontee que findEntryInRulesetChain, mais pour lister plutot que
 * chercher une cle : s'arrete au premier ruleset de la chaine qui a des
 * entrees a lui (un monde variante sans rien a soi remonte jusqu'a son
 * ancetre officiel). Pas de fusion base+variante ici, ce sera le travail
 * de la resolution de surcharge (V1-A4) — ce que la variante ne possede
 * pas encore n'existe simplement pas dans cette liste.
 */
async function listEntriesInRulesetChain(
  supabase: TypedClient,
  rulesetId: string,
  locale: Locale
): Promise<RuleEntrySummary[]> {
  let currentId: string | null = rulesetId;
  for (let hop = 0; currentId && hop < MAX_RULESET_CHAIN_DEPTH; hop++) {
    const entries = await listRulesetEntries(supabase, currentId);
    if (entries.length > 0) {
      const translationByEntryId = new Map<string, string>();
      if (locale !== "en") {
        const translations = await listTranslationsForEntries(supabase, entries.map((e) => e.id), locale);
        for (const t of translations) translationByEntryId.set(t.entry_id, t.name);
      }
      return entries.map((e) => ({
        key: e.entry_key,
        entryType: e.entry_type as EntryType,
        name: translationByEntryId.get(e.id) ?? entryNameFrom(e),
      }));
    }
    const ruleset = await getRulesetById(supabase, currentId);
    currentId = ruleset?.parent_ruleset_id ?? null;
  }
  return [];
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
