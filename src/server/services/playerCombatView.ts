import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import { getActiveCombatForCampaign, listPlayerCombatViewRows, type PlayerCombatViewRow } from "@/src/server/repos/combats";
import { getCampaignById } from "@/src/server/repos/campaigns";
import {
  orderPlayerCombatView,
  type PlayerCombatParticipant,
  type PlayerCombatRow,
  type WoundState,
} from "@/src/core/rules/combatPlayerView";

type TypedClient = SupabaseClient<Database>;

export type PlayerCombatViewResult =
  | { kind: "forbidden" }
  | { kind: "none" }
  | {
      kind: "ok";
      combat: { id: string; name: string | null; status: string; round: number; turnIndex: number; updatedAt: string };
      participants: PlayerCombatParticipant[];
    };

const WOUNDS: readonly WoundState[] = ["unhurt", "hurt", "bloodied", "down"];

function toConditions(value: Json): string[] {
  return Array.isArray(value) ? value.filter((c): c is string => typeof c === "string") : [];
}

/** Adapte une ligne de la base (snake_case) vers le noyau ; ce qui n'est pas « allié » est traité en adversaire. */
function toRow(row: PlayerCombatViewRow): PlayerCombatRow {
  const ally = row.side === "ally";
  return {
    id: row.id,
    label: row.label,
    initiative: row.initiative,
    displayOrder: Number(row.display_order),
    side: ally ? "ally" : "enemy",
    entityId: ally ? row.entity_id : null,
    conditions: toConditions(row.conditions),
    hp: ally ? { current: row.hp_current, max: row.hp_max, temp: row.temp_hp ?? 0 } : null,
    wound: !ally && WOUNDS.includes(row.wound as WoundState) ? (row.wound as WoundState) : null,
  };
}

/**
 * V3.1-102 (ADR 0040) — le combat en cours d'une campagne, tel qu'une joueuse
 * a le droit de le voir. Les colonnes viennent filtrées de la base
 * (`public.combat_player_view`) : ce service ne reçoit jamais de PV ni de CA
 * adverses, il n'a donc rien à cacher. Il ordonne avec le même tri que
 * l'écran du MJ, pour que le tour en cours désigne le même participant.
 *
 * Coût (QUOTAS) : deux lectures (le combat, la vue) par appel, plus la
 * campagne pour la garde.
 */
export async function getPlayerCombatView(supabase: TypedClient, campaignId: string): Promise<PlayerCombatViewResult> {
  // Lisible des seuls membres du monde (RLS `campaigns_select`) : sinon, refus.
  const campaign = await getCampaignById(supabase, campaignId);
  if (!campaign) return { kind: "forbidden" };

  const combat = await getActiveCombatForCampaign(supabase, campaignId);
  if (!combat) return { kind: "none" };

  const rows = await listPlayerCombatViewRows(supabase, combat.id);
  if (rows === null) return { kind: "forbidden" };

  return {
    kind: "ok",
    combat: {
      id: combat.id,
      name: combat.name,
      status: combat.status,
      round: combat.round,
      turnIndex: combat.turn_index,
      updatedAt: combat.updated_at,
    },
    participants: orderPlayerCombatView(rows.map(toRow), { status: combat.status, turnIndex: combat.turn_index }),
  };
}
