import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { decideSheetActionAccess, type SheetActionAccess } from "@/src/core/permissions/sheetActionAccess";
import { DEFAULT_TABLE_SETTINGS, parseTableSettings, type CampaignTableSettings, type PlayerEditableField } from "@/src/core/campaigns/tableSettings";
import { getEntityById } from "@/src/server/repos/entities";
import { getCampaignById, getCampaignTableSettingsRaw } from "@/src/server/repos/campaigns";
import { canUserEditEntity, isWorldAdmin } from "@/src/server/services/permissions";

type TypedClient = SupabaseClient<Database>;

/**
 * V3.1-108 (ADR 0043) — rassemble ce que `decideSheetActionAccess` juge :
 * la fiche, le droit de l'editer, la campagne envoyee et ses interrupteurs.
 * Les reglages ne sont lus que si le geste touche un champ regle.
 */
export async function checkSheetActionAccess(
  supabase: TypedClient,
  params: { userId: string; entityId: string; campaignId: string | null; field?: PlayerEditableField }
): Promise<{ access: SheetActionAccess; settings: CampaignTableSettings }> {
  const entity = await getEntityById(supabase, params.entityId);
  const callerCanEdit = entity ? await canUserEditEntity(supabase, { worldId: entity.world_id, entityId: params.entityId, userId: params.userId }) : false;
  const campaignRow = params.campaignId && entity && callerCanEdit ? await getCampaignById(supabase, params.campaignId) : undefined;
  const campaign = params.campaignId === null ? undefined : campaignRow ? { worldId: campaignRow.world_id } : null;

  const sameWorld = Boolean(entity && campaignRow && campaignRow.world_id === entity.world_id);
  const needsSwitch = Boolean(params.field && sameWorld && entity);
  const callerIsGm = needsSwitch && entity ? await isWorldAdmin(supabase, { worldId: entity.world_id, userId: params.userId }) : false;
  const settings =
    needsSwitch && params.campaignId ? parseTableSettings(await getCampaignTableSettingsRaw(supabase, params.campaignId)) : DEFAULT_TABLE_SETTINGS;

  const access = decideSheetActionAccess({
    entityWorldId: entity ? entity.world_id : null,
    callerCanEdit,
    callerIsGm,
    campaign,
    field: params.field,
    settings,
  });
  return { access, settings };
}
