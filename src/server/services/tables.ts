import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import type { Rng } from "@/src/core/dice/rng";
import type { BlockReference } from "@/src/core/schemas/blocks/reference";
import { zRandomTableBlockData, type RandomTableBlockData } from "@/src/core/schemas/blocks/randomTable";
import type { TableEntryPrice } from "@/src/core/tables/types";
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

/** V3.1-75 : un sous-tirage de la cascade (`{table:cle}`), dans l'ordre ou ses des se figent a l'ecran. */
export interface ResolvedSubDraw {
  key: string;
  die: string;
  roll: number;
  text: string;
}

export interface ResolvedTableDraw {
  text: string;
  /** V3.1-75 : les sous-tirages, profondeur d'abord ; vide sans cascade. */
  subDraws: ResolvedSubDraw[];
  refs: BlockReference[];
  /** Prix de l'entree TIREE (retour utilisateur) — jamais celui d'une sous-table resolue en cascade, aucun cas d'usage actuel pour un prix qui traverserait une cascade. */
  price?: TableEntryPrice;
  /** Palier de l'entree TIREE (V2-J9quater, accord entre emplacements) — meme discipline que `price`, jamais celui d'une sous-table de cascade. */
  tier?: string;
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
export async function findTableBlockByKey(
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
 *
 * Exportee pour reutilisation par `generators.ts` (V1-E2) : un emplacement
 * de generateur tire sur une table exactement comme un tirage direct, meme
 * moteur, memes garde-fous de profondeur/cycle.
 */
export async function resolveCascade(
  supabase: TypedClient,
  entityId: string,
  draw: TableDraw,
  rng: Rng,
  visited: ReadonlySet<string>,
  depth: number
): Promise<ResolvedTableDraw> {
  const cascadeKeys = [...new Set(draw.cascadeKeys)];
  const resultsByKey = new Map<string, string>();
  const subDraws: ResolvedSubDraw[] = [];

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
    subDraws.push({ key, die: subTable.die, roll: subDraw.roll, text: resolvedSub.text }, ...resolvedSub.subDraws);
  }

  return {
    text: interpolateCascadeResults(draw.entry.text, resultsByKey),
    subDraws,
    refs: draw.entry.refs ?? [],
    price: draw.entry.price,
    tier: draw.entry.tier,
  };
}

/**
 * Tire `count` resultats sur le bloc `random_table` `blockId`, cascades
 * resolues (V1-E1). `null` si le bloc n'existe pas ou n'est pas une table
 * — jamais une exception pour un simple "pas trouve" (RLS s'en charge deja
 * en amont : un bloc que l'appelant ne peut pas lire n'apparait jamais ici).
 */
/** V3.1-75 : un tirage direct, avec ce que l'ecran anime — le de de la table, son chiffre, la ligne sortie. */
export interface BlockTableDraw extends ResolvedTableDraw {
  die: string;
  roll: number;
  index: number;
}

export async function drawFromTableBlock(
  supabase: TypedClient,
  blockId: string,
  rng: Rng,
  count: number,
  /** V3.1-75 : « Sans repetition » d'un appel a l'autre — indices des entrees deja sorties (ignore sans `unique_draws`). */
  alreadyDrawn: ReadonlySet<number> = new Set()
): Promise<BlockTableDraw[] | null> {
  const block = await getBlockById(supabase, blockId);
  if (!block || block.block_type !== "random_table") return null;

  const table = zRandomTableBlockData.parse(block.data);
  const draws = drawMultiple(table, count, rng, alreadyDrawn);

  const resolved: BlockTableDraw[] = [];
  for (const draw of draws) {
    const cascade = await resolveCascade(supabase, block.entity_id, draw, rng, new Set([table.key]), 1);
    resolved.push({ ...cascade, die: table.die, roll: draw.roll, index: draw.index });
  }
  return resolved;
}
