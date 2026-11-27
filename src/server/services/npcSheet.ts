import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { getRuleEntryForWorld } from "@/src/server/services/rules";
import { createBlockWithData } from "@/src/server/services/blocks";
import { statblockFromMonsterBlocks } from "@/src/core/rules/srdMapping";
import { npcSheetFrom, npcSheetKey } from "@/src/core/rules/npcSheet";
import type { ActionsBlockData, LegendaryActionsBlockData, StatBlockBlockData, TraitsBlockData } from "@/src/core/schemas/rule-blocks";

type TypedClient = SupabaseClient<Database>;

export type GiveNpcSheetOutcome =
  | { ok: true; templateKey: string; fallback: boolean }
  | { ok: false; reason: "template_not_found" | "forbidden" };

/**
 * V3.2-47 (ADR 0118) — Donne sa fiche allégée à un PNJ qui vient de naître
 * dans le wiki : la fiche du SRD choisie d'après son archétype de vie,
 * ajustée à graine fixe (`npcSheetFrom`), dans un bloc `statblock` réservé au
 * MJ. La personne qui joue la découvrira par indices (V3.2-49, 50).
 *
 * Coût : une lecture de la fiche de règle (et de sa chaîne de rulesets), une
 * création de bloc. Seulement à l'ancrage d'un PNJ, jamais à chaque tour.
 */
export async function giveNpcSheet(
  supabase: TypedClient,
  params: { worldId: string; entityId: string; archetype?: string; seed: number; callerId: string }
): Promise<GiveNpcSheetOutcome> {
  const { key, fallback } = npcSheetKey(params.archetype);
  // Le nom des blocs ne sert pas ici : seules les valeurs du `stat_block` sont reprises.
  const entry = await getRuleEntryForWorld(supabase, params.worldId, key, "fr");
  const statBlock = entry?.blocks.find((b) => b.blockType === "stat_block")?.data as StatBlockBlockData | undefined;
  if (!entry || !statBlock) return { ok: false, reason: "template_not_found" };

  const base = statblockFromMonsterBlocks({
    statBlock,
    traits: entry.blocks.find((b) => b.blockType === "traits")?.data as TraitsBlockData | undefined,
    actions: entry.blocks.find((b) => b.blockType === "actions")?.data as ActionsBlockData | undefined,
    legendaryActions: entry.blocks.find((b) => b.blockType === "legendary_actions")?.data as LegendaryActionsBlockData | undefined,
  });
  const sheet = npcSheetFrom(base, { templateKey: key, ...(params.archetype !== undefined ? { archetype: params.archetype } : {}), seed: params.seed });

  const created = await createBlockWithData(supabase, {
    entityId: params.entityId,
    blockType: "statblock",
    label: "Fiche",
    visibilityLevel: "gm",
    visibilityScopeId: null,
    createdBy: params.callerId,
    data: sheet,
  });
  return created.ok ? { ok: true, templateKey: key, fallback } : { ok: false, reason: "forbidden" };
}
