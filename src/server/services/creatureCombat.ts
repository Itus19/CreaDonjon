import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { getActiveCombatForCampaign, listCombatParticipants } from "@/src/server/repos/combats";
import { getEntityById } from "@/src/server/repos/entities";
import { resolveCampaignId } from "@/src/server/services/campaigns";
import { isWorldAdmin } from "@/src/server/services/permissions";

type TypedClient = SupabaseClient<Database>;

/**
 * V3.1-79 — la fiche de créature « en combat » : ses instances dans
 * l'initiative en cours (un participant dont `entity_id` est la fiche ;
 * « Gobelin ×4 » = quatre participants). Le bloc `statblock` reste un
 * MODÈLE (specs/outils-mj.md §5) : PV courants et états vivent dans
 * l'instance, lus ici et écrits par la route existante du participant.
 *
 * Réservé au MJ : un joueur ne lit ni n'écrit les PV d'un monstre depuis sa
 * fiche (la vue joueuse du combat a sa propre route, filtrée). Un combat en
 * brouillon ou terminé n'est pas « en cours ».
 */

const ETATS_EN_COURS = new Set(["rolling", "running", "paused"]);

export interface CreatureCombatInstance {
  participantId: string;
  label: string;
  hpCurrent: number | null;
  hpMax: number | null;
  tempHp: number;
  conditions: string[];
}

export interface CreatureCombat {
  campaignId: string;
  combatId: string;
  instances: CreatureCombatInstance[];
}

export async function getCreatureCombat(
  supabase: TypedClient,
  params: { entityId: string; userId: string }
): Promise<CreatureCombat | null> {
  const entity = await getEntityById(supabase, params.entityId);
  if (!entity) return null;
  const [admin, campaignId] = await Promise.all([
    isWorldAdmin(supabase, { worldId: entity.world_id, userId: params.userId }),
    resolveCampaignId(supabase, entity.world_id),
  ]);
  if (!admin || !campaignId) return null;

  const combat = await getActiveCombatForCampaign(supabase, campaignId);
  if (!combat || !ETATS_EN_COURS.has(combat.status)) return null;

  const instances = (await listCombatParticipants(supabase, combat.id))
    .filter((p) => p.entity_id === entity.id)
    .map((p) => ({
      participantId: p.id,
      label: p.label,
      hpCurrent: p.hp_current,
      hpMax: p.hp_max,
      tempHp: p.temp_hp,
      conditions: Array.isArray(p.conditions) ? p.conditions.filter((c): c is string => typeof c === "string") : [],
    }));
  if (instances.length === 0) return null;
  return { campaignId, combatId: combat.id, instances };
}
