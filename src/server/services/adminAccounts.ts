import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { listAllAccountsForAdmin, type AdminAccountRow } from "@/src/server/repos/account";
import { isSuperadmin } from "@/src/server/services/account";
import {
  deleteAnyAccount,
  forcePasswordReset,
  listRulesetsOwnedBy,
  transferRulesetOwnership,
  type DeleteAnyAccountResult,
  type ForcePasswordResetResult,
  type OwnedRulesetSummary,
  type TransferRulesetResult,
} from "@/src/server/services/accountAuth";

type TypedClient = SupabaseClient<Database>;

/**
 * Panneau Administration, gestes generalises a TOUT compte (V3.1-10) —
 * verifie `isSuperadmin` ICI, avant de relayer vers le module confine
 * (`accountAuth.ts`, qui n'a pas de notion de "qui appelle"). Meme motif
 * que `campaignInvites.deleteInvitedAccount` pour le premier trou.
 */
export async function listAccountsForAdmin(supabase: TypedClient, callerId: string): Promise<AdminAccountRow[] | null> {
  if (!(await isSuperadmin(supabase, callerId))) return null;
  return listAllAccountsForAdmin(supabase);
}

export async function adminForcePasswordReset(
  supabase: TypedClient,
  params: { callerId: string; targetUserId: string }
): Promise<ForcePasswordResetResult | { ok: false; reason: "not_authorized" }> {
  if (!(await isSuperadmin(supabase, params.callerId))) return { ok: false, reason: "not_authorized" };
  return forcePasswordReset({ targetUserId: params.targetUserId, actingUserId: params.callerId });
}

export async function adminDeleteAccount(
  supabase: TypedClient,
  params: { callerId: string; targetUserId: string }
): Promise<DeleteAnyAccountResult | { ok: false; reason: "not_authorized" }> {
  if (!(await isSuperadmin(supabase, params.callerId))) return { ok: false, reason: "not_authorized" };
  return deleteAnyAccount(params.targetUserId);
}

export async function adminListOwnedRulesets(
  supabase: TypedClient,
  params: { callerId: string; targetUserId: string }
): Promise<OwnedRulesetSummary[] | null> {
  if (!(await isSuperadmin(supabase, params.callerId))) return null;
  return listRulesetsOwnedBy(params.targetUserId);
}

export async function adminTransferRuleset(
  supabase: TypedClient,
  params: { callerId: string; rulesetId: string; newOwnerId: string }
): Promise<TransferRulesetResult | { ok: false; reason: "not_authorized" }> {
  if (!(await isSuperadmin(supabase, params.callerId))) return { ok: false, reason: "not_authorized" };
  return transferRulesetOwnership({ rulesetId: params.rulesetId, newOwnerId: params.newOwnerId });
}
