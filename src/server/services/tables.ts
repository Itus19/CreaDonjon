import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import type { Rng } from "@/src/core/dice/rng";
import type { BlockReference } from "@/src/core/schemas/blocks/reference";
import { zRandomTableBlockData, type RandomTableBlockData } from "@/src/core/schemas/blocks/randomTable";
import {
  drawMultiple,
  drawOnce,
  interpolateCascadeResults,
  type SingleTableDraw,
  type TableDraw,
} from "@/src/core/tables/roll";
import { MAX_TABLE_CASCADE_DEPTH, TableCascadeCycleError, TableCascadeDepthError } from "@/src/core/tables/errors";
import { getBlockById, listBlocksForEntity } from "@/src/server/repos/blocks";

type TypedClient = SupabaseClient<Database>;

export interface ResolvedTableDraw {
  text: string;
  refs: BlockReference[];
}

/**
 * Table `random_table` de la meme entite que `key` designe (V1-E1,
 * specs/outils-mj.md §2.1) — portee volontairement limitee a UNE entite,
 * pas une bibliotheque partagee entre entites du monde : cas concret pas
 * encore demande, meme discipline que le bloc `weapon` de ruleset (V1-D4),
 * un seul type de bloc en portee plutot qu'un mecanisme generique.
 * `getBlockById` reste soumis a la RLS du client appelant : une table
 * `gm`-only referencee en cascade depuis une table publique resout
 * simplement a rien (le texte `{table:x}` reste tel quel, voir
 * `interpolateCascadeResults`) si l'appelant ne peut pas la lire — jamais
 * de fuite de visibilite par ce chemin.
 */
async function findTableBlockByKey(
  supabase: TypedClient,
  entityId: string,
  key: string
): Promise<RandomTableBlockData | null> {
  const blocks = await listBlocksForEntity(supabase, entityId);
  for (const block of blocks) {
    if (block.block_type !== "random_table") continue;
    const parsed = zRandomTableBlockData.safeParse(block.data);
    if (parsed.success && parsed.data.key === key) return parsed.data;
  }
  return null;
}

/**
 * Resout un tirage jusqu'a son texte final, en resolvant chaque reference
 * `{table:cle}` en cascade (specs/outils-mj.md §2.1 : "Profondeur bornee a
 * 3, cycles detectes"). `visited` porte les cles deja traversees sur CE
 * chemin de descente (pas globalement) — deux branches independantes
 * peuvent referencer la meme table sans que ce soit un cycle.
 */
async function resolveCascade(
  supabase: TypedClient,
  entityId: string,
  draw: TableDraw,
  rng: Rng,
  visited: ReadonlySet<string>,
  depth: number
): Promise<ResolvedTableDraw> {
  const cascadeKeys = [...new Set(draw.cascadeKeys)];
  const resultsByKey = new Map<string, string>();

  for (const key of cascadeKeys) {
    if (visited.has(key)) throw new TableCascadeCycleError(key);
    if (depth >= MAX_TABLE_CASCADE_DEPTH) throw new TableCascadeDepthError();

    const subTable = await findTableBlockByKey(supabase, entityId, key);
    if (!subTable || subTable.entries.length === 0) continue; // reference vers une table introuvable/illisible : le texte garde `{table:cle}` tel quel

    const subDraw: SingleTableDraw = drawOnce(subTable, rng);
    const subVisited = new Set(visited);
    subVisited.add(key);
    const resolvedSub = await resolveCascade(supabase, entityId, subDraw, rng, subVisited, depth + 1);
    resultsByKey.set(key, resolvedSub.text);
  }

  return {
    text: interpolateCascadeResults(draw.entry.text, resultsByKey),
    refs: draw.entry.refs ?? [],
  };
}

/**
 * Tire `count` resultats sur le bloc `random_table` `blockId`, cascades
 * resolues (V1-E1). `null` si le bloc n'existe pas ou n'est pas une table
 * — jamais une exception pour un simple "pas trouve" (RLS s'en charge deja
 * en amont : un bloc que l'appelant ne peut pas lire n'apparait jamais ici).
 */
export async function drawFromTableBlock(
  supabase: TypedClient,
  blockId: string,
  rng: Rng,
  count: number
): Promise<ResolvedTableDraw[] | null> {
  const block = await getBlockById(supabase, blockId);
  if (!block || block.block_type !== "random_table") return null;

  const table = zRandomTableBlockData.parse(block.data);
  const draws = drawMultiple(table, count, rng);

  const resolved: ResolvedTableDraw[] = [];
  for (const draw of draws) {
    resolved.push(await resolveCascade(supabase, block.entity_id, draw, rng, new Set([table.key]), 1));
  }
  return resolved;
}
