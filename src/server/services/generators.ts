import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import type { Rng } from "@/src/core/dice/rng";
import type { BlockReference } from "@/src/core/schemas/blocks/reference";
import { zGeneratorBlockData } from "@/src/core/schemas/blocks/generator";
import { drawOnce } from "@/src/core/tables/roll";
import { renderGeneratorTemplate } from "@/src/core/generators/render";
import { getBlockById } from "@/src/server/repos/blocks";
import { findTableBlockByKey, resolveCascade } from "@/src/server/services/tables";

type TypedClient = SupabaseClient<Database>;

export interface GeneratorSlotResult {
  key: string;
  text: string;
  refs: BlockReference[];
}

export interface GeneratorResult {
  text: string;
  slots: GeneratorSlotResult[];
}

/**
 * Tire un resultat sur le bloc `generator` `blockId` (V1-E2,
 * specs/outils-mj.md §3) : un tirage par emplacement, sur une table
 * `random_table` de la MEME entite (meme discipline que la cascade de
 * V1-E1 — reutilise `findTableBlockByKey`/`resolveCascade` telles quelles,
 * aucun moteur separe). Un emplacement dont la table est introuvable ou
 * illisible (RLS) laisse son `{cle}` tel quel dans le gabarit plutot que
 * de faire echouer tout le tirage — meme discipline que `{table:cle}` dans
 * une cascade, un generateur mal configure reste visible pour etre
 * corrige. `null` si le bloc n'existe pas ou n'est pas un generateur.
 */
export async function drawFromGeneratorBlock(
  supabase: TypedClient,
  blockId: string,
  rng: Rng
): Promise<GeneratorResult | null> {
  const block = await getBlockById(supabase, blockId);
  if (!block || block.block_type !== "generator") return null;

  const generator = zGeneratorBlockData.parse(block.data);

  const slots: GeneratorSlotResult[] = [];
  const slotTexts: Record<string, string> = {};
  for (const slot of generator.slots) {
    const table = await findTableBlockByKey(supabase, block.entity_id, slot.table);
    if (!table || table.entries.length === 0) continue;

    const draw = drawOnce(table, rng);
    const resolved = await resolveCascade(supabase, block.entity_id, draw, rng, new Set([table.key]), 1);
    slots.push({ key: slot.key, text: resolved.text, refs: resolved.refs });
    slotTexts[slot.key] = resolved.text;
  }

  return { text: renderGeneratorTemplate(generator.template, slotTexts), slots };
}
