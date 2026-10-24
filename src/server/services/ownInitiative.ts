import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { getCombatById, listPlayerCombatViewRows } from "@/src/server/repos/combats";
import { getClaimedCharacterEntityId } from "@/src/server/repos/campaigns";
import { journalCombatEvent } from "@/src/server/services/combats";
import { rollInitiativeCheck } from "@/src/server/services/checkRolls";
import { resolveCharacterActionContext } from "@/src/server/services/characterActions";
import { isOwnInitiativeInRange, ownInitiativeFromDie } from "@/src/core/rules/combat";
import type { MyInitiativeInput } from "@/lib/combats/schemas";
import type { Locale } from "@/src/i18n/request";

type TypedClient = SupabaseClient<Database>;

export type SetMyInitiativeResult =
  /** `natural` (V3.1-38) : le d20 tiré ou annoncé, pour la zone de résultat de l'outil de dés ; `null` si seul le total est connu. */
  | { ok: true; initiative: number; participantId: string; natural: number | null }
  | { ok: false; reason: "not_found" | "not_rolling" | "no_character" | "not_in_combat" | "out_of_range" | "refused" };

/**
 * V3.1-103 (ADR 0040) — une joueuse écrit l'initiative de SON PJ pendant les
 * jets (`rolling`). Les vérifications d'ici donnent un message clair ; la
 * barrière réelle est `public.set_own_initiative`, qui les refait toutes (PJ
 * réclamé par l'appelant, statut, bornes) et refuse le reste.
 *
 * « roll » : le serveur tire par le jet d'initiative de la fiche (règle 8) —
 * le jet est enregistré et attribué comme tout jet (V3.1-89). « die » : le dé
 * de la table, le serveur ajoute la Dextérité de la fiche si besoin.
 * L'écriture est journalisée au nom de la joueuse, annulable par le MJ.
 */
export async function setMyInitiative(
  supabase: TypedClient,
  params: { campaignId: string; combatId: string; userId: string; locale: Locale; input: MyInitiativeInput }
): Promise<SetMyInitiativeResult> {
  // Lisible des seuls membres (RLS `combats_select`).
  const combat = await getCombatById(supabase, params.combatId);
  if (!combat || combat.campaign_id !== params.campaignId) return { ok: false, reason: "not_found" };
  if (combat.status !== "rolling") return { ok: false, reason: "not_rolling" };

  const entityId = await getClaimedCharacterEntityId(supabase, { campaignId: params.campaignId, userId: params.userId });
  if (!entityId) return { ok: false, reason: "no_character" };

  // La joueuse ne lit pas `combat_participants` : elle trouve son participant dans sa vue filtrée.
  const rows = await listPlayerCombatViewRows(supabase, combat.id);
  const mine = rows?.find((row) => row.side === "ally" && row.entity_id === entityId);
  if (!mine) return { ok: false, reason: "not_in_combat" };

  let value: number;
  let natural: number | null = null;
  if (params.input.mode === "roll") {
    const rolled = await rollInitiativeCheck(supabase, {
      entityId,
      campaignId: params.campaignId,
      callerId: params.userId,
      advantage: "normal",
      dc: null,
      hidden: false,
      locale: params.locale,
    });
    if (!rolled.ok) return { ok: false, reason: "refused" };
    value = rolled.roll.total;
    natural = rolled.roll.naturalD20;
  } else {
    const ctx = await resolveCharacterActionContext(supabase, entityId, params.campaignId, params.locale);
    if (!ctx) return { ok: false, reason: "no_character" };
    value = ownInitiativeFromDie(params.input, ctx.sheet.abilities.dex.mod);
    natural = params.input.modifierIncluded ? null : params.input.natural;
  }
  if (!isOwnInitiativeInRange(value)) return { ok: false, reason: "out_of_range" };

  const { data, error } = await supabase.rpc("set_own_initiative", { p_participant: mine.id, p_value: value });
  if (error) throw new Error(error.message);
  if (data === null || typeof data !== "object" || Array.isArray(data)) return { ok: false, reason: "refused" };
  const written = data as { before?: unknown; after?: unknown };

  await journalCombatEvent(supabase, combat, {
    target: "participant",
    targetId: mine.id,
    before: written.before,
    after: written.after,
    note: `Initiative de ${mine.label} : ${value}`,
    actorUserId: params.userId,
    actor: "player",
  });
  return { ok: true, initiative: value, participantId: mine.id, natural };
}
