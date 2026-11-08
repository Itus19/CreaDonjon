import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import type { Locale } from "@/src/i18n/request";
import type { BonusDie } from "@/src/core/rules/sheet";
import { monsterSaveBonus } from "@/src/core/rules/targeting";
import { zActionsBlockData, zLegendaryActionsBlockData, zStatBlockBlockData, type StatBlockBlockData } from "@/src/core/schemas/rule-blocks";
import type { formatFormulaNode } from "@/src/core/formula/format";
import type { CombatParticipantRow } from "@/src/server/repos/combats";
import { resolveCharacterActionContext } from "@/src/server/services/characterActions";
import { getRuleEntryForWorld } from "@/src/server/services/rules";

type TypedClient = SupabaseClient<Database>;

/**
 * La sauvegarde d'un participant du combat, et les blocs d'un monstre. Sortis
 * du service des jets ciblés (V3.1-195) : la bascule de tour en a besoin pour
 * le JS répété, et ce service importe celui des combats.
 */

export interface MonsterBlocks {
  statBlock: StatBlockBlockData | null;
  actions: { name: string; attack_bonus?: number; damage?: { dice: Parameters<typeof formatFormulaNode>[0]; type?: string }[] }[];
}

export async function loadMonsterBlocks(supabase: TypedClient, params: { worldId: string; ruleKey: string; locale: Locale }): Promise<MonsterBlocks | null> {
  const entry = await getRuleEntryForWorld(supabase, params.worldId, params.ruleKey, params.locale);
  if (!entry) return null;
  const bloc = (type: string) => entry.blocks.find((b) => b.blockType === type)?.data;
  const stat = zStatBlockBlockData.safeParse(bloc("stat_block"));
  const actions = zActionsBlockData.safeParse(bloc("actions"));
  const legendary = zLegendaryActionsBlockData.safeParse(bloc("legendary_actions"));
  return {
    statBlock: stat.success ? stat.data : null,
    actions: [...(actions.success ? actions.data.actions : []), ...(legendary.success ? legendary.data.actions : [])],
  };
}

/** Le bonus de sauvegarde d'une cible : un PJ par sa fiche, un monstre par son bloc de stats, sinon 0 (et on le dit). */
export async function targetSaveBonus(
  supabase: TypedClient,
  params: { target: CombatParticipantRow; isPc: boolean; ability: string; campaignId: string; worldId: string; locale: Locale }
): Promise<{ bonus: number; hint: string | null; dice: BonusDie[] }> {
  const ability = params.ability.toLowerCase();
  if (params.target.entity_id && params.isPc) {
    const ctx = await resolveCharacterActionContext(supabase, params.target.entity_id, params.campaignId, params.locale);
    const save = ctx?.sheet.savingThrows[ability as keyof typeof ctx.sheet.savingThrows];
    // V3.1-156 (ADR 0074) : un PJ béni ajoute son 1d4, lancé par le serveur avec le d20.
    if (save) return { bonus: save.mod, hint: null, dice: save.dice };
  }
  if (params.target.rule_key) {
    const monster = await loadMonsterBlocks(supabase, { worldId: params.worldId, ruleKey: params.target.rule_key, locale: params.locale });
    if (monster?.statBlock) return { bonus: monsterSaveBonus(monster.statBlock, ability), hint: null, dice: [] };
  }
  return { bonus: 0, hint: `Sauvegarde de ${params.target.label} sans fiche ni bloc de stats : bonus compté à 0.`, dice: [] };
}
