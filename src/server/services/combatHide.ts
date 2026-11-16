import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import { resolveCheckRoll } from "@/src/core/rules/action";
import { abilityModifier } from "@/src/core/rules/combat";
import { perceptionConditions } from "@/src/core/rules/perception";
import { zStatBlockBlockData } from "@/src/core/schemas/rule-blocks";
import { getCombatById, getCombatParticipantById, listPlayerCombatViewRows, updateCombatParticipant } from "@/src/server/repos/combats";
import { getClaimedCharacterEntityId } from "@/src/server/repos/campaigns";
import { insertDiceRoll } from "@/src/server/repos/diceRolls";
import { checkCombatAccess, journalCombatEvent, patchCombatParticipant } from "@/src/server/services/combats";
import { resolveCharacterActionContext } from "@/src/server/services/characterActions";
import { applySignedEngineChange, readCombatParticipantsSigned } from "@/src/server/services/engineSigning";
import { getCampaign } from "@/src/server/services/campaigns";
import { getOrOpenSessionForCampaign } from "@/src/server/services/sessions";
import { getRuleEntryForWorld } from "@/src/server/services/rules";
import { recomputeMasking } from "@/src/server/services/combatPerception";
import { serverRng } from "@/src/server/services/rng";
import type { Locale } from "@/src/i18n/request";

type TypedClient = SupabaseClient<Database>;

/** Se cacher (règles 2024) : un test de Dextérité (Discrétion) contre DD 15 ; réussi, la créature est Cachée, avec ce total. */
export const DD_SE_CACHER = 15;

export type HideResult =
  | { ok: true; participantId: string; total: number; hidden: boolean }
  | { ok: false; reason: "not_found" | "not_running" | "no_character" | "not_yours" };

/**
 * V3.1-181 (ADR 0078) — Se cacher. Le serveur lance le test (règle 8) : la
 * Discrétion de la fiche pour un PJ, celle du bloc de stats (ou la Dextérité)
 * pour une créature. Réussi : l'état Caché, et `stealth_total` contre lequel
 * se mesurera la Perception de qui le cherche ; raté : rien. Le MJ fait cacher
 * tout le monde ; une joueuse, son seul PJ (ses écritures passent par
 * changement signé). Journalisé, puis le masquage des joueuses est recalculé.
 */
export async function hideParticipant(
  supabase: TypedClient,
  params: { campaignId: string; combatId: string; participantId: string; userId: string; locale: Locale },
): Promise<HideResult> {
  const combat = await getCombatById(supabase, params.combatId);
  if (!combat || combat.campaign_id !== params.campaignId) return { ok: false, reason: "not_found" };
  if (combat.status !== "running") return { ok: false, reason: "not_running" };
  const campaign = await getCampaign(supabase, params.campaignId);
  if (!campaign) return { ok: false, reason: "not_found" };
  const callerIsGm = (await checkCombatAccess(supabase, { userId: params.userId, campaignId: params.campaignId, combatId: params.combatId, participantId: params.participantId })) === "ok";

  // La ligne, et la fiche quand c'est un PJ.
  let row = callerIsGm ? await getCombatParticipantById(supabase, params.participantId) : null;
  let entityId: string | null = row?.entity_id ?? null;
  if (!callerIsGm) {
    const mine = await getClaimedCharacterEntityId(supabase, { campaignId: params.campaignId, userId: params.userId });
    if (!mine) return { ok: false, reason: "no_character" };
    const vue = (await listPlayerCombatViewRows(supabase, combat.id))?.find((r) => r.id === params.participantId);
    if (!vue) return { ok: false, reason: "not_found" };
    if (vue.side !== "ally" || vue.entity_id !== mine) return { ok: false, reason: "not_yours" };
    row = (await readCombatParticipantsSigned(supabase, { campaignId: params.campaignId, combatId: combat.id })).find((r) => r.id === params.participantId) ?? null;
    entityId = mine;
  }
  if (!row || row.combat_id !== combat.id) return { ok: false, reason: "not_found" };

  const ctx = entityId ? await resolveCharacterActionContext(supabase, entityId, params.campaignId, params.locale) : null;
  let modificateur = 0;
  let avantage: "normal" | "advantage" | "disadvantage" = "normal";
  let des: NonNullable<typeof ctx>["sheet"]["skills"]["stealth"]["dice"] = [];
  if (ctx) {
    const s = ctx.sheet.skills.stealth;
    modificateur = s.mod;
    avantage = s.rollState;
    des = s.dice;
  } else if (row.rule_key) {
    const entry = await getRuleEntryForWorld(supabase, campaign.worldId, row.rule_key, params.locale);
    const stat = zStatBlockBlockData.safeParse(entry?.blocks.find((b) => b.blockType === "stat_block")?.data);
    if (stat.success) {
      const comp = stat.data.skills?.find((k) => /stealth|discr[ée]tion/i.test(k.name));
      modificateur = comp ? comp.bonus : abilityModifier(stat.data.abilities.dex);
    }
  }
  const jet = resolveCheckRoll({ modifier: modificateur, advantage: avantage, bonusDice: des }, serverRng);
  const cache = jet.total >= DD_SE_CACHER;
  const nom = ctx?.entityName ?? row.label;

  const sessionId = await getOrOpenSessionForCampaign(supabase, params.campaignId);
  await insertDiceRoll(supabase, {
    sessionId,
    campaignId: params.campaignId,
    expression: jet.expression,
    ast: jet.ast as Json,
    context: { mod: modificateur },
    result: jet.total,
    detail: { who: nom, what: "Se cacher (Discrétion)", trace: jet.trace } as unknown as Json,
    rolledBy: callerIsGm ? "gm" : "player",
    // Le total d'un Caché est ce contre quoi l'adversaire cherchera : il reste au lanceur et au MJ.
    visibilityLevel: "roller",
    attribution: { entityId, kind: "check" },
  });

  if (cache) {
    const etats = Array.isArray(row.conditions) ? row.conditions.filter((c): c is string => typeof c === "string") : [];
    const avec = perceptionConditions(etats).includes("hidden") ? etats : [...etats, "hidden"];
    if (callerIsGm) {
      await patchCombatParticipant(supabase, { participantId: row.id, patch: { conditions: avec }, actorUserId: params.userId, note: `${nom} se cache (Discrétion ${jet.total})` });
      await updateCombatParticipant(supabase, row.id, { stealthTotal: jet.total });
    } else {
      await applySignedEngineChange(supabase, {
        campaignId: params.campaignId,
        changes: [
          { kind: "participant", id: row.id, conditions: avec },
          ...(entityId ? [{ kind: "runtime" as const, id: entityId, conditions: avec }] : []),
          { kind: "perception", id: row.id, perception: { stealth_total: jet.total } },
        ],
      });
      await journalCombatEvent(supabase, combat, {
        target: "participant",
        targetId: row.id,
        before: row,
        after: { ...row, conditions: avec, stealth_total: jet.total },
        note: `${nom} se cache (Discrétion ${jet.total})`,
        actorUserId: params.userId,
        actor: "player",
      });
    }
    await recomputeMasking(supabase, { campaignId: params.campaignId, combat, callerIsGm, locale: params.locale });
  }
  return { ok: true, participantId: row.id, total: jet.total, hidden: cache };
}
