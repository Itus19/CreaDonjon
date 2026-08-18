import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { parseEncounterBudgetRows, type EncounterBudgetRow } from "@/src/core/rules/encounter";
import { getRulesetEntryByKey, listBlocksForRulesetEntry } from "@/src/server/repos/rules";

type TypedClient = SupabaseClient<Database>;

/**
 * Table "Budget de PX par personnage" du ruleset (V1-E3, specs/outils-mj.md
 * §4.1) — lue depuis l'entree de regle `encounter-budget` (bloc
 * `custom_table`, ecrite par `scripts/write-encounter-budget-2024.ts`).
 * `null` si le ruleset n'a pas cette entree : c'est le cas normal pour le
 * SRD 5.1 (2014), qui ne republie pas cette table dans son contenu sous
 * licence libre — jamais une valeur inventee pour combler ce trou, l'appelant
 * doit afficher "budget non disponible" plutot qu'un chiffre invente.
 */
export async function getEncounterBudgetTable(
  supabase: TypedClient,
  rulesetId: string
): Promise<EncounterBudgetRow[] | null> {
  const entry = await getRulesetEntryByKey(supabase, rulesetId, "encounter-budget");
  if (!entry) return null;

  const blocks = await listBlocksForRulesetEntry(supabase, entry.id);
  const table = blocks.find((b) => b.block_type === "custom_table");
  if (!table) return null;

  const rows = (table.data as unknown as { rows?: Record<string, unknown>[] }).rows ?? [];
  const parsed = parseEncounterBudgetRows(rows);
  return parsed.length > 0 ? parsed : null;
}
