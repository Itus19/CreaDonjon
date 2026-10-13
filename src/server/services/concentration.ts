import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { applyConcentrationChange, type ConcentrationChange } from "@/src/core/rules/concentration";
import type { Concentration } from "@/src/core/schemas/runtimeState";
import { applyRuntimeStateChange, getEntityRuntimeState } from "@/src/server/services/runtimeState";
import { getOrOpenSessionForCampaign } from "@/src/server/services/sessions";

type TypedClient = SupabaseClient<Database>;

/**
 * V3.1-24 (ADR 0036 §3) — LE point unique ou une concentration change.
 *
 * Lancer un sort de concentration (`castSpell`, qui remplace la precedente)
 * et « Rompre » (`breakConcentration`) passent tous deux par ici, et le noyau
 * (`applyConcentrationChange`) dit ce qui s'est rompu. C'est la que V3.1-130
 * (ADR 0060) retirera les effets durables de concentration : `change.broken`
 * est le seul signal dont elle a besoin. Ne retirer une concentration par
 * aucun autre chemin.
 *
 * Aucune synchronisation vers `combat_participants` ici : l'ecriture d'un
 * participant est reservee au MJ (RLS), et les etats ne la font aussi que dans
 * le sens participant -> fiche (`patchCombatParticipant`).
 */
export async function setConcentration(
  supabase: TypedClient,
  params: { entityId: string; campaignId: string | null; incoming: Concentration | null; actorUserId: string }
): Promise<ConcentrationChange> {
  const state = await getEntityRuntimeState(supabase, params.entityId, params.campaignId);
  const change = applyConcentrationChange(state.concentration, params.incoming);
  // Rien ne change (meme sort relance, ou rien a rompre) : aucune ecriture, aucun evenement.
  if (change.next === state.concentration) return change;

  const sessionId = params.campaignId ? await getOrOpenSessionForCampaign(supabase, params.campaignId) : null;
  const note = change.next
    ? change.broken
      ? `Concentration : ${change.broken.label} rompue, ${change.next.label} commence`
      : `Concentration : ${change.next.label}`
    : `Concentration rompue : ${change.broken?.label ?? ""}`;
  await applyRuntimeStateChange(supabase, {
    entityId: params.entityId,
    campaignId: params.campaignId,
    patch: { concentration: change.next },
    note,
    sessionId,
    actor: "player",
    actorUserId: params.actorUserId,
  });
  return change;
}

/** « Rompre » : retire la concentration en cours. Sans effet s'il n'y en a pas. */
export async function breakConcentration(
  supabase: TypedClient,
  params: { entityId: string; campaignId: string | null; actorUserId: string }
): Promise<ConcentrationChange> {
  return setConcentration(supabase, { ...params, incoming: null });
}
