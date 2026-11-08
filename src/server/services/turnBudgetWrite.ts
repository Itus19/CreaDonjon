import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import { EMPTY_TURN_USAGE, zTurnUsage } from "@/src/core/rules/rollWindow";
import { budgetForTurn, grantTurnBudget, ownTurnStamp, spendTurnBudget, type TurnBudget, type TurnSpend } from "@/src/core/rules/turnBudget";
import { getActiveCombatForCampaign, listCombatParticipants, updateCombatParticipant } from "@/src/server/repos/combats";
import { orderParticipants } from "@/src/server/services/combats";
import { applySignedEngineChange, readCombatParticipantsSigned } from "@/src/server/services/engineSigning";

type TypedClient = SupabaseClient<Database>;

/**
 * V3.1-165 (ADR 0076) — compter l'économie d'action d'un participant en
 * combat : lire son compte de tour, dépenser (et accorder), réécrire. Hors
 * combat (pas de combat en cours, ou l'acteur n'y est pas), rien n'est compté
 * et `null` revient. Jamais bloquant (ADR 0029) : `over` le dit, l'appelant
 * l'affiche. Le MJ écrit la ligne ; une joueuse, par changement signé (ADR 0041).
 */
export async function spendTurnBudgetFor(
  supabase: TypedClient,
  params: {
    campaignId: string;
    actor: { entityId: string } | { participantId: string };
    kind: TurnSpend;
    attacksPerAction: number;
    grants?: readonly { kind: "action" | "bonus"; amount: number; notMagic?: boolean }[];
    callerIsGm: boolean;
  },
): Promise<{ over: boolean; budget: TurnBudget } | null> {
  const combat = await getActiveCombatForCampaign(supabase, params.campaignId);
  if (!combat || combat.status !== "running") return null;
  const participants = params.callerIsGm
    ? await listCombatParticipants(supabase, combat.id)
    : await readCombatParticipantsSigned(supabase, { campaignId: params.campaignId, combatId: combat.id });
  const ordre = orderParticipants(participants);
  const row = participants.find((p) => ("entityId" in params.actor ? p.entity_id === params.actor.entityId : p.id === params.actor.participantId));
  if (!row) return null;
  const ownIndex = Math.max(0, ordre.findIndex((o) => o.id === row.id));
  const lu = zTurnUsage.safeParse(row.turn_usage);
  const usage = lu.success ? lu.data : EMPTY_TURN_USAGE;
  let budget = budgetForTurn(usage.budget, ownTurnStamp({ round: combat.round, turnIndex: combat.turn_index }, ownIndex));
  for (const g of params.grants ?? []) budget = grantTurnBudget(budget, g);
  const spent = spendTurnBudget(budget, params.kind, params.attacksPerAction);
  const next = { ...usage, budget: spent.budget };
  if (params.callerIsGm) await updateCombatParticipant(supabase, row.id, { turnUsage: next as unknown as Json });
  else await applySignedEngineChange(supabase, { campaignId: params.campaignId, changes: [{ kind: "turn_usage", id: row.id, turn_usage: next }] });
  return spent;
}
