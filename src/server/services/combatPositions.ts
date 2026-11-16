import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { distance, feetToPlanMetres, type Point } from "@/src/core/rules/geometry";
import { getCombatById, getCombatParticipantById, listPlayerCombatViewRows, setOwnPosition, updateCombatParticipant } from "@/src/server/repos/combats";
import { getClaimedCharacterEntityId } from "@/src/server/repos/campaigns";
import { checkCombatAccess, journalCombatEvent } from "@/src/server/services/combats";
import { resolveCharacterActionContext } from "@/src/server/services/characterActions";
import { spendMovementFor } from "@/src/server/services/turnBudgetWrite";
import type { Locale } from "@/src/i18n/request";

type TypedClient = SupabaseClient<Database>;

export type MoveResult =
  | {
      ok: true;
      participantId: string;
      position: Point | null;
      /** Le mouvement du tour, quand le déplacement a eu lieu pendant le tour d'un PJ ; jamais bloquant. */
      movement: { moved: number; speed: number; over: boolean } | null;
    }
  | { ok: false; reason: "not_found" | "ended" | "no_character" | "not_yours" | "refused" };

const arrondi = (n: number) => Math.round(n * 2) / 2;
const libellePosition = (p: Point | null) => (p ? `(${arrondi(p.x)} ; ${arrondi(p.y)})` : "retiré du plan");

/**
 * V3.1-169 (ADR 0077) — déplacer un jeton sur le plan. Le MJ déplace tout le
 * monde, et peut retirer un jeton (`null`) ; une joueuse, son seul PJ, par
 * `public.set_own_position` qui refait les vérifications. Chaque déplacement
 * est journalisé (annulable par le MJ). Pendant le tour d'un PJ, la distance
 * parcourue dépense son mouvement (ADR 0076) : un dépassement est signalé,
 * jamais bloqué. La première pose d'un jeton ne coûte rien.
 *
 * Coût (QUOTAS) : une lecture du combat et du participant, une écriture, une
 * ligne de journal ; pendant le tour d'un PJ seulement, une fiche et le
 * compte de tour en plus.
 */
export async function moveParticipant(
  supabase: TypedClient,
  params: { campaignId: string; combatId: string; userId: string; participantId: string; position: Point | null; locale: Locale },
): Promise<MoveResult> {
  const combat = await getCombatById(supabase, params.combatId);
  if (!combat || combat.campaign_id !== params.campaignId) return { ok: false, reason: "not_found" };
  if (combat.status === "ended" || combat.status === "draft") return { ok: false, reason: "ended" };

  const access = await checkCombatAccess(supabase, { userId: params.userId, campaignId: params.campaignId, combatId: params.combatId, participantId: params.participantId });
  const callerIsGm = access === "ok";

  let before: Point | null;
  let entityId: string | null;
  let label: string;
  let written: { before: unknown; after: unknown };

  if (callerIsGm) {
    const row = await getCombatParticipantById(supabase, params.participantId);
    if (!row || row.combat_id !== combat.id) return { ok: false, reason: "not_found" };
    before = row.pos_x !== null && row.pos_y !== null ? { x: Number(row.pos_x), y: Number(row.pos_y) } : null;
    entityId = row.entity_id;
    label = row.label;
    const after = await updateCombatParticipant(supabase, row.id, { position: params.position });
    written = { before: row, after };
  } else {
    if (!params.position) return { ok: false, reason: "refused" };
    const mine = await getClaimedCharacterEntityId(supabase, { campaignId: params.campaignId, userId: params.userId });
    if (!mine) return { ok: false, reason: "no_character" };
    // La joueuse ne lit pas `combat_participants` : elle trouve son jeton dans sa vue filtrée.
    const rows = await listPlayerCombatViewRows(supabase, combat.id);
    const row = rows?.find((r) => r.id === params.participantId);
    if (!row) return { ok: false, reason: "not_found" };
    if (row.side !== "ally" || row.entity_id !== mine) return { ok: false, reason: "not_yours" };
    before = row.pos_x != null && row.pos_y != null ? { x: Number(row.pos_x), y: Number(row.pos_y) } : null;
    entityId = row.entity_id;
    label = row.label;
    const r = await setOwnPosition(supabase, { participantId: row.id, x: params.position.x, y: params.position.y });
    if (!r) return { ok: false, reason: "refused" };
    written = r;
  }

  // Le mouvement : seulement pour un PJ (fiche de personnage), seulement si le jeton était déjà posé.
  let movement: { moved: number; speed: number; over: boolean } | null = null;
  if (before && params.position && entityId && combat.status === "running") {
    const metres = distance(before, params.position);
    const ctx = metres > 0 ? await resolveCharacterActionContext(supabase, entityId, params.campaignId, params.locale) : null;
    if (ctx) {
      const speed = feetToPlanMetres(ctx.sheet.speed.value);
      const spent = await spendMovementFor(supabase, { campaignId: params.campaignId, actor: { participantId: params.participantId }, metres, speedMetres: speed, callerIsGm });
      if (spent) movement = { moved: spent.moved, speed, over: spent.over };
    }
  }

  const note = `${label} : ${libellePosition(before)} → ${libellePosition(params.position)}${movement ? `, ${arrondi(movement.moved)} m sur ${movement.speed} m${movement.over ? " (dépassement)" : ""}` : ""}`;
  await journalCombatEvent(supabase, combat, {
    target: "participant",
    targetId: params.participantId,
    before: written.before,
    after: written.after,
    note,
    actorUserId: params.userId,
    actor: callerIsGm ? "gm" : "player",
  });

  return { ok: true, participantId: params.participantId, position: params.position, movement };
}
