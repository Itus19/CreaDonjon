import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import { validateBlockData } from "@/src/core/schemas/rule-blocks";
import { zHouseVersionPayload } from "@/src/core/rules/houseVersion";
import { applyOverrideFacts, COVERAGE_ENTRY_TYPES, pruneOrphanDurableEffects, type BlockFacts } from "@/src/core/rules/activationEditor";
import { coverageState, MECHANICAL_BLOCK_TYPES, type CoverageState } from "@/src/core/rules/activation";
import type { EntryType } from "@/src/core/schemas/rule-blocks";
import type { Locale } from "@/src/i18n/request";
import type { ActivationBlockData } from "@/src/core/schemas/rule-blocks/playable";
import type { ResolvableBlock } from "@/src/core/rules/resolve";
import { getWorldDefaultRulesetId } from "@/src/server/repos/worlds";
import { listEntryBlockFacts, listOverridesForRuleset, listOverridesForRulesets, upsertRulesetOverride } from "@/src/server/repos/rules";
import { DEFAULT_BLOCK_DISPLAY, listEntriesInRulesetChain, resolveEntryBlocksInRuleset, walkRulesetChain } from "@/src/server/services/rules";

type TypedClient = SupabaseClient<Database>;

/**
 * V3.1-132 — enregistrer les briques jouables d'une règle (`resources`,
 * `activation`, `coverage`) depuis l'éditeur. Toujours dans la VARIANTE
 * active du monde, jamais dans l'officielle (règle 18 ; la RPC le refuse de
 * toute façon, et seul le créateur de la variante écrit).
 *
 * Une variante n'a qu'UNE surcharge par type de bloc et par règle
 * (`overrides_target_uniq`) : on la réécrit selon ce qu'il y a « en dessous »
 * (la même règle résolue dans le ruleset parent) —
 *   - une donnée, et le bloc existe en dessous : `replace_block` ;
 *   - une donnée, et rien en dessous : `add_block` ;
 *   - `null` : `remove_block` (sans rien en dessous, il annule l'ajout précédent).
 * Une fiche maison de la variante (`add_entry`) garde ses `add_block` ; une
 * version maison (`replace_entry`, ADR 0072) se réécrit d'un seul tenant.
 */

export const PLAYABLE_BLOCK_TYPES = ["resources", "activation", "coverage"] as const;
export type PlayableBlockType = (typeof PLAYABLE_BLOCK_TYPES)[number];

/** `undefined` : ne pas toucher ; `null` : retirer le bloc ; un objet : la donnée (revalidée ici). */
export type PlayableBlocksInput = Partial<Record<PlayableBlockType, unknown>>;

export type SavePlayableBlocksResult =
  | { ok: true; rulesetId: string }
  | { ok: false; reason: "no_variant" | "not_found" | "invalid"; message?: string };

/** Après les blocs existants d'une règle officielle (leurs ordres vont de 100 en 100). */
const DISPLAY_ORDER: Record<PlayableBlockType, number> = { resources: 9000, activation: 9100, coverage: 9200 };

function validate(input: PlayableBlocksInput): Map<PlayableBlockType, unknown | null> {
  const out = new Map<PlayableBlockType, unknown | null>();
  for (const t of PLAYABLE_BLOCK_TYPES) {
    const v = input[t];
    if (v === undefined) continue;
    if (v === null) {
      out.set(t, null);
      continue;
    }
    const data = validateBlockData(t, v);
    // « Appliquer un état » est une brique : son effet qui dure part avec elle.
    out.set(t, t === "activation" ? pruneOrphanDurableEffects(data as ActivationBlockData) : data);
  }
  return out;
}

function blockPayload(t: PlayableBlockType, data: unknown): ResolvableBlock {
  return { block_type: t, display: DEFAULT_BLOCK_DISPLAY[t], data, display_order: DISPLAY_ORDER[t] };
}

export async function savePlayableBlocks(
  supabase: TypedClient,
  params: { worldId: string; entryKey: string; blocks: PlayableBlocksInput }
): Promise<SavePlayableBlocksResult> {
  let rulesetId = await getWorldDefaultRulesetId(supabase, params.worldId);
  if (!rulesetId) return { ok: false, reason: "not_found" };
  const chain = await walkRulesetChain(supabase, rulesetId);
  if (chain[0]?.isOfficialBase ?? true) return { ok: false, reason: "no_variant" };

  let changes: Map<PlayableBlockType, unknown | null>;
  try {
    changes = validate(params.blocks);
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, reason: "invalid", message: error.issues[0]?.message ?? "Donnée invalide." };
    throw error;
  }
  if (changes.size === 0) return { ok: true, rulesetId };

  const own = await listOverridesForRuleset(supabase, rulesetId, params.entryKey);
  const note = "Briques jouables";

  // Version maison : la copie entière se réécrit, ses autres blocs inchangés.
  const house = own.find((r) => r.action === "replace_entry");
  if (house) {
    const copie = zHouseVersionPayload.parse(house.payload);
    let blocks = copie.blocks;
    for (const [t, data] of changes) {
      const i = blocks.findIndex((b) => b.block_type === t);
      if (data === null) blocks = blocks.filter((b) => b.block_type !== t);
      else if (i >= 0) blocks = blocks.map((b, k) => (k === i ? { ...b, data } : b));
      else blocks = [...blocks, blockPayload(t, data)];
    }
    const payload = zHouseVersionPayload.parse({ ...copie, blocks });
    rulesetId = await upsertRulesetOverride(supabase, {
      rulesetId,
      entryKey: params.entryKey,
      blockType: null,
      action: "replace_entry",
      payload: payload as unknown as Json,
      patch: null,
      note,
    });
    return { ok: true, rulesetId };
  }

  // En dessous : rien pour une fiche maison de la variante ; sinon la règle telle que le parent la résout.
  const homebrew = own.some((r) => r.action === "add_entry");
  const parent = chain[1]?.rulesetId;
  const below = homebrew || !parent ? null : await resolveEntryBlocksInRuleset(supabase, parent, params.entryKey);
  if (!homebrew && !below) return { ok: false, reason: "not_found" };

  for (const [t, data] of changes) {
    const existeDessous = below?.blocksByType.has(t) ?? false;
    rulesetId = await upsertRulesetOverride(supabase, {
      rulesetId,
      entryKey: params.entryKey,
      blockType: t,
      action: data === null ? "remove_block" : existeDessous ? "replace_block" : "add_block",
      payload: data === null ? {} : (blockPayload(t, data) as unknown as Json),
      patch: null,
      note,
    });
  }
  return { ok: true, rulesetId };
}

export interface UnplayableRule {
  key: string;
  name: string;
  entryType: EntryType;
  state: Exclude<CoverageState, "playable">;
  gaps: number;
}

/**
 * V3.1-132 — la vue « règles non jouables » du ruleset actif d'un monde :
 * chaque aptitude, sort ou objet magique sans bloc mécanique (non évaluée) ou
 * avec des lacunes déclarées (partielle). Trois lectures : la liste (déjà celle
 * de la barre latérale), les types de blocs mécaniques de la base, les
 * surcharges des variantes. Rien n'est stocké (règle 16).
 */
export async function listUnplayableRules(supabase: TypedClient, params: { worldId: string; locale: Locale }): Promise<UnplayableRule[] | null> {
  const rulesetId = await getWorldDefaultRulesetId(supabase, params.worldId);
  if (!rulesetId) return null;
  const chain = await walkRulesetChain(supabase, rulesetId);
  const base = chain.find((l) => l.isOfficialBase);
  const variantes = chain.filter((l) => !l.isOfficialBase);

  const [entries, facts, overrides] = await Promise.all([
    listEntriesInRulesetChain(supabase, rulesetId, params.locale),
    base ? listEntryBlockFacts(supabase, base.rulesetId, [...MECHANICAL_BLOCK_TYPES]) : Promise.resolve([]),
    listOverridesForRulesets(
      supabase,
      variantes.map((l) => l.rulesetId)
    ),
  ]);

  const depart = new Map<string, BlockFacts>(entries.map((e) => [e.key, { types: new Set<string>(), gaps: 0 }]));
  for (const f of facts) {
    const d = depart.get(f.entry_key);
    if (!d) continue;
    d.types.add(f.block_type);
    if (f.block_type === "coverage") d.gaps = Array.isArray((f.data as { gaps?: unknown } | null)?.gaps) ? (f.data as { gaps: unknown[] }).gaps.length : 0;
  }
  // De la racine vers la feuille, comme `applyOverrides` : la chaîne va de la variante active à la base.
  const rang = new Map(chain.map((l, i) => [l.rulesetId, i]));
  const ordonnees = [...overrides].sort((a, b) => (rang.get(b.ruleset_id) ?? 0) - (rang.get(a.ruleset_id) ?? 0));
  const resolues = applyOverrideFacts(
    depart,
    ordonnees.map((o) => ({ entryKey: o.entry_key, action: o.action, blockType: o.block_type, payload: o.payload }))
  );

  const out: UnplayableRule[] = [];
  for (const e of entries) {
    if (!(COVERAGE_ENTRY_TYPES as readonly string[]).includes(e.entryType)) continue;
    const f = resolues.get(e.key);
    if (!f) continue;
    const state = coverageState({ blockTypes: [...f.types], gaps: new Array(f.gaps) });
    if (state !== "playable") out.push({ key: e.key, name: e.name, entryType: e.entryType, state, gaps: f.gaps });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, params.locale));
}
