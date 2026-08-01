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
  getRulesetById,
  getRulesetEntryByKey,
  listBlocksForRulesetEntry,
  type RulesetEntryRow,
} from "@/src/server/repos/rules";
import { getWorldDefaultRulesetId } from "@/src/server/repos/worlds";
import { getWorldBySlug } from "@/src/server/services/worlds";

type TypedClient = SupabaseClient<Database>;

/** Profondeur maximale de remontee vers un ruleset parent — meme borne que la resolution de surcharge (V1-A4), en attendant qu'elle existe. */
const MAX_RULESET_CHAIN_DEPTH = 8;

const SLOT_LEVEL_MAX = 9;
const CHARACTER_LEVEL_MAX = 20;

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
}

export interface RuleEntryDetail {
  id: string;
  entryKey: string;
  entryType: EntryType;
  name: string;
  sourceAttribution: string | null;
  blocks: RuleEntryBlockView[];
  missingBlocks: string[];
}

function maxLevelForAxis(axis: ScalingBlockData["axis"]): number {
  return axis === "slot_level" ? SLOT_LEVEL_MAX : CHARACTER_LEVEL_MAX;
}

function entryNameFrom(entry: RulesetEntryRow): string {
  const sourceRaw = entry.source_raw as { name?: unknown } | null;
  const name = sourceRaw && typeof sourceRaw.name === "string" ? sourceRaw.name : null;
  return name ?? entry.entry_key;
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
  entryKey: string
): Promise<RuleEntryDetail | null> {
  const rulesetId = await getWorldDefaultRulesetId(supabase, worldId);
  if (!rulesetId) return null;

  const entry = await findEntryInRulesetChain(supabase, rulesetId, entryKey);
  if (!entry) return null;

  const blockRows = await listBlocksForRulesetEntry(supabase, entry.id);

  const validated = blockRows.map((row) => ({
    row,
    blockType: row.block_type as BlockType,
    data: dataSchemaForBlockType(row.block_type as BlockType).parse(row.data),
  }));

  const effectsData = validated.find((b) => b.blockType === "effects")?.data as
    | EffectsBlockData
    | undefined;

  const blocks: RuleEntryBlockView[] = validated.map(({ row, blockType, data }) => {
    const display = zBlockDisplay.parse(row.display);

    if (blockType === "scaling") {
      const scalingData = data as ScalingBlockData;
      const baseFormula = scalingData.rule
        ? resolveScalingTarget(scalingData.rule.target, effectsData)
        : undefined;
      const table = generateScalingTable(scalingData, maxLevelForAxis(scalingData.axis), baseFormula);
      return {
        id: row.id,
        blockType,
        display,
        data: { ...scalingData, table },
        displayOrder: row.display_order,
      };
    }

    if (blockType === "class_progression") {
      const progressionData = data as ClassProgressionBlockData;
      return {
        id: row.id,
        blockType,
        display,
        data: { ...progressionData, rows: computeProgressionRows(progressionData) },
        displayOrder: row.display_order,
      };
    }

    return { id: row.id, blockType, display, data, displayOrder: row.display_order };
  });

  return {
    id: entry.id,
    entryKey: entry.entry_key,
    entryType: entry.entry_type as EntryType,
    name: entryNameFrom(entry),
    sourceAttribution: entry.source_attribution,
    blocks,
    missingBlocks: missingRequiredBlocks(
      entry.entry_type as EntryType,
      blockRows.map((b) => b.block_type)
    ),
  };
}

/** Composition pour la route `/m/[worldSlug]/regles/[cle]` : `null` si le monde ou la regle sont introuvables — la page traduit ça en 404. */
export async function getRuleEntryPageData(
  supabase: TypedClient,
  worldSlug: string,
  entryKey: string
): Promise<RuleEntryDetail | null> {
  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) return null;
  return getRuleEntryForWorld(supabase, world.id, entryKey);
}
