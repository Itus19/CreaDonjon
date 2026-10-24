import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import type { CampaignTableSettings } from "@/src/core/campaigns/tableSettings";
import { getEntityById } from "@/src/server/repos/entities";
import { listCampaignCharacters, listCampaignsForWorld } from "@/src/server/repos/campaigns";
import { getWorldDefaultRulesetId } from "@/src/server/repos/worlds";
import type { SelectableRulesetRow } from "@/src/server/repos/rules";
import { listSelectableRulesetsForCurrentUser } from "@/src/server/services/rules";
import { listVisibleBlocks, type VisibleBlock } from "@/src/server/services/blocks";
import { readTableSettings } from "@/src/server/services/tableSettings";

type TypedClient = SupabaseClient<Database>;

/** Tout ce que l'écran Règles actives montre à sa première vue (V3.1-57, docs/CABLAGE.md C1). */
export interface ReglesActivesData {
  /** Les officiels et les variantes de l'appelant, avec leur parent (l'arbre). */
  options: SelectableRulesetRow[];
  current: string | null;
  /** La campagne du monde et ses interrupteurs ; `null` sans campagne. */
  campaign: { id: string; tableSettings: CampaignTableSettings } | null;
  /** Le PJ dont la fiche sert d'aperçu (une joueuse de préférence) et ses blocs ; `null` sans PJ. */
  apercu: { entityId: string; entityName: string; blocks: VisibleBlock[] } | null;
}

/**
 * V3.1-57 — l'écran Règles actives du MJ, page et fenêtre : les rulesets,
 * celui qui est actif, les interrupteurs de la campagne et un PJ pour
 * l'aperçu de la fiche. Le PJ choisi est le premier tenu par une joueuse
 * (sinon le premier PJ) ; ses blocs passent par le même filtre de
 * visibilité que la fiche.
 */
export async function chargerReglesActives(
  supabase: TypedClient,
  world: { id: string },
  userId: string
): Promise<ReglesActivesData> {
  const [options, current, campaigns] = await Promise.all([
    listSelectableRulesetsForCurrentUser(supabase),
    getWorldDefaultRulesetId(supabase, world.id),
    listCampaignsForWorld(supabase, world.id),
  ]);
  const campaignRow = campaigns[0] ?? null;
  if (!campaignRow) return { options: options ?? [], current, campaign: null, apercu: null };

  const [settings, characters] = await Promise.all([readTableSettings(supabase, campaignRow.id), listCampaignCharacters(supabase, campaignRow.id)]);
  const pcs = characters.filter((c) => c.is_pc);
  const choisi = pcs.find((c) => c.user_id !== null) ?? pcs[0] ?? null;
  const [entity, blocks] = choisi
    ? await Promise.all([getEntityById(supabase, choisi.entity_id), listVisibleBlocks(supabase, world.id, choisi.entity_id, userId)])
    : [null, []];

  return {
    options: options ?? [],
    current,
    campaign: settings === "not_found" ? null : { id: campaignRow.id, tableSettings: settings },
    apercu: entity ? { entityId: entity.id, entityName: entity.name, blocks } : null,
  };
}
