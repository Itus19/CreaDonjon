import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import type { Locale } from "@/src/i18n/request";
import { ABILITY_LABELS, SKILL_ABILITIES, type Ability, type Skill, type Source } from "@/src/core/rules/sheet";
import { SKILL_LABELS_FR } from "@/src/i18n/fr";
import { resolveCheckRoll, type AdvantageState } from "@/src/core/rules/action";
import type { TraceStep } from "@/src/core/formula/evaluate";
import { DIE_TYPES, type DieType } from "@/src/core/dice/roll";
import { parseFormula } from "@/src/core/formula/parser";
import { evaluate } from "@/src/core/formula/evaluate";
import { formatFormulaNode } from "@/src/core/formula/format";
import { resolveCharacterActionContext } from "@/src/server/services/characterActions";
import { canUserEditEntityById, isWorldAdmin } from "@/src/server/services/permissions";
import { getEntityById, type EntitySummary } from "@/src/server/repos/entities";
import { getCampaignById, getClaimedCharacterEntityId } from "@/src/server/repos/campaigns";
import { insertDiceRoll } from "@/src/server/repos/diceRolls";
import { getOrOpenSessionForCampaign } from "@/src/server/services/sessions";
import { serverRng } from "@/src/server/services/rng";

type TypedClient = SupabaseClient<Database>;

/**
 * V2-M11 (Lot M, volet de lancer de des) : jets de test/competence/
 * sauvegarde/initiative depuis une fiche, plus un jet libre sans fiche
 * (reserve du volet). Reutilise ce qui existe deja plutot que d'inventer
 * une seconde voie : `resolveCharacterActionContext` (meme fiche derivee
 * que les boutons d'attaque, V1-B5), `canUserEditEntityById` (meme regle
 * que "qui peut editer cette fiche" — rouler pour un personnage est un
 * geste du meme ordre), `resolveCheckRoll` (meme d20+modificateur qu'une
 * attaque, jamais de critique).
 */

export type CheckRollErrorReason = "not_found" | "forbidden";
export type CheckRollResult = { ok: true; roll: RollOutcome } | { ok: false; reason: CheckRollErrorReason };

export interface RollOutcome {
  who: string;
  what: string;
  chips: Source[];
  total: number;
  expression: string;
  dc: number | null;
  verdict: "success" | "fail" | null;
  hidden: boolean;
  /** V2-M11 (volet) : affichage immediat cote client (forme des des, valeurs individuelles) sans attendre l'evenement Realtime — meme structure que `dice_rolls.detail.trace`, jamais recalculee. */
  trace: TraceStep[];
  /** false si `campaignId` etait nul (fiche vue hors campagne, meme convention que `rollWeaponAttack` — characterActions.ts) : le jet a eu lieu mais n'est pas ecrit dans `dice_rolls`, donc absent du volet et de l'historique. */
  recorded: boolean;
}

interface RollParams {
  entityId: string;
  campaignId: string | null;
  callerId: string;
  advantage: AdvantageState;
  dc: number | null;
  /** Ignore si l'appelant n'est pas MJ (`isWorldAdmin`) — jamais fait confiance tel quel, cote serveur comme cote RLS. */
  hidden: boolean;
  locale: Locale;
}

/** "Cet appelant peut-il rouler pour cette fiche" — meme regle que l'editer (PJ revendique, MJ, ou fiche accordee), jamais une regle parallele. */
async function requireCanRollForEntity(
  supabase: TypedClient,
  params: { entityId: string; callerId: string }
): Promise<{ ok: true; worldId: string; entity: EntitySummary } | { ok: false; reason: CheckRollErrorReason }> {
  const entity = await getEntityById(supabase, params.entityId);
  if (!entity) return { ok: false, reason: "not_found" };
  const allowed = await canUserEditEntityById(supabase, { entityId: params.entityId, userId: params.callerId });
  if (!allowed) return { ok: false, reason: "forbidden" };
  return { ok: true, worldId: entity.world_id, entity };
}

function verdictFor(total: number, dc: number | null): "success" | "fail" | null {
  if (dc === null) return null;
  return total >= dc ? "success" : "fail";
}

async function recordAndBuildOutcome(
  supabase: TypedClient,
  params: {
    campaignId: string | null;
    who: string;
    what: string;
    chips: Source[];
    advantage: AdvantageState;
    dc: number | null;
    hidden: boolean;
  }
): Promise<RollOutcome> {
  const modifier = params.chips.reduce((sum, c) => sum + c.value, 0);
  const { total, ast, expression, trace } = resolveCheckRoll({ modifier, advantage: params.advantage }, serverRng);
  const verdict = verdictFor(total, params.dc);

  if (params.campaignId) {
    const sessionId = await getOrOpenSessionForCampaign(supabase, params.campaignId);
    await insertDiceRoll(supabase, {
      sessionId,
      campaignId: params.campaignId,
      expression,
      ast: ast as unknown as Json,
      context: { modifier } as unknown as Json,
      result: total,
      detail: { who: params.who, what: params.what, chips: params.chips, dc: params.dc, verdict, trace } as unknown as Json,
      rolledBy: "player",
      visibilityLevel: params.hidden ? "gm" : "public",
    });
  }

  return {
    who: params.who,
    what: params.what,
    chips: params.chips,
    total,
    expression,
    dc: params.dc,
    verdict,
    hidden: params.hidden,
    recorded: params.campaignId !== null,
    trace,
  };
}

export async function rollAbilityCheck(
  supabase: TypedClient,
  params: RollParams & { ability: Ability }
): Promise<CheckRollResult> {
  const check = await requireCanRollForEntity(supabase, params);
  if (!check.ok) return check;
  const isAdmin = await isWorldAdmin(supabase, { worldId: check.worldId, userId: params.callerId });
  const ctx = await resolveCharacterActionContext(supabase, params.entityId, params.campaignId, params.locale);
  if (!ctx) return { ok: false, reason: "not_found" };

  const chips: Source[] = [{ label: ABILITY_LABELS[params.ability], value: ctx.sheet.abilities[params.ability].mod }];
  const roll = await recordAndBuildOutcome(supabase, {
    campaignId: params.campaignId,
    who: check.entity.name,
    what: `Test de ${ABILITY_LABELS[params.ability]}`,
    chips,
    advantage: params.advantage,
    dc: params.dc,
    hidden: params.hidden && isAdmin,
  });
  return { ok: true, roll };
}

export async function rollSkillCheck(
  supabase: TypedClient,
  params: RollParams & { skill: Skill }
): Promise<CheckRollResult> {
  const check = await requireCanRollForEntity(supabase, params);
  if (!check.ok) return check;
  const isAdmin = await isWorldAdmin(supabase, { worldId: check.worldId, userId: params.callerId });
  const ctx = await resolveCharacterActionContext(supabase, params.entityId, params.campaignId, params.locale);
  if (!ctx) return { ok: false, reason: "not_found" };

  const skillResult = ctx.sheet.skills[params.skill];
  const governingAbility = ABILITY_LABELS[SKILL_ABILITIES[params.skill]];
  const roll = await recordAndBuildOutcome(supabase, {
    campaignId: params.campaignId,
    who: check.entity.name,
    what: `${SKILL_LABELS_FR[params.skill]} — test de ${governingAbility}`,
    chips: skillResult.sources,
    advantage: params.advantage,
    dc: params.dc,
    hidden: params.hidden && isAdmin,
  });
  return { ok: true, roll };
}

export async function rollSavingThrow(
  supabase: TypedClient,
  params: RollParams & { ability: Ability }
): Promise<CheckRollResult> {
  const check = await requireCanRollForEntity(supabase, params);
  if (!check.ok) return check;
  const isAdmin = await isWorldAdmin(supabase, { worldId: check.worldId, userId: params.callerId });
  const ctx = await resolveCharacterActionContext(supabase, params.entityId, params.campaignId, params.locale);
  if (!ctx) return { ok: false, reason: "not_found" };

  const saveResult = ctx.sheet.savingThrows[params.ability];
  const roll = await recordAndBuildOutcome(supabase, {
    campaignId: params.campaignId,
    who: check.entity.name,
    what: `Sauvegarde de ${ABILITY_LABELS[params.ability]}`,
    chips: saveResult.sources,
    advantage: params.advantage,
    dc: params.dc,
    hidden: params.hidden && isAdmin,
  });
  return { ok: true, roll };
}

export async function rollInitiativeCheck(supabase: TypedClient, params: RollParams): Promise<CheckRollResult> {
  const check = await requireCanRollForEntity(supabase, params);
  if (!check.ok) return check;
  const isAdmin = await isWorldAdmin(supabase, { worldId: check.worldId, userId: params.callerId });
  const ctx = await resolveCharacterActionContext(supabase, params.entityId, params.campaignId, params.locale);
  if (!ctx) return { ok: false, reason: "not_found" };

  const chips: Source[] = [{ label: ABILITY_LABELS.dex, value: ctx.sheet.abilities.dex.mod }];
  const roll = await recordAndBuildOutcome(supabase, {
    campaignId: params.campaignId,
    who: check.entity.name,
    what: "Initiative",
    chips,
    advantage: params.advantage,
    dc: params.dc,
    hidden: params.hidden && isAdmin,
  });
  return { ok: true, roll };
}

export type FreeformRollErrorReason = "invalid_pool";
export type FreeformRollResult = { ok: true; roll: RollOutcome } | { ok: false; reason: FreeformRollErrorReason };

/**
 * Jet libre depuis la reserve du volet (V2-M11) — aucune fiche, jamais de
 * modificateur (retour utilisateur : "les valeurs sont vides"). N'importe
 * quel membre de la campagne peut en faire un ; seul le MJ peut le
 * marquer cache (`hidden`, clampe ci-dessous, jamais fait confiance au
 * client). RLS `dice_rolls_write` refuse deja l'ecriture a qui n'est pas
 * membre — pas de second controle d'appartenance ici.
 */
export async function rollFreeformCheck(
  supabase: TypedClient,
  params: {
    campaignId: string;
    callerId: string;
    pool: Partial<Record<DieType, number>>;
    who: string;
    hidden: boolean;
  }
): Promise<FreeformRollResult> {
  const entries = DIE_TYPES.flatMap((type) => {
    const count = params.pool[type] ?? 0;
    return count > 0 ? [{ type, count }] : [];
  });
  if (entries.length === 0) return { ok: false, reason: "invalid_pool" };

  const campaign = await getCampaignById(supabase, params.campaignId);
  const isAdmin = campaign ? await isWorldAdmin(supabase, { worldId: campaign.world_id, userId: params.callerId }) : false;

  // meme moteur que les autres jets (formule -> AST -> evaluate), jamais un
  // calcul manuel parallele — "2d20+1d8" se lit et se rejoue exactement
  // comme "1d6+1d4" pour les degats (resolveDamageRoll).
  const ast = parseFormula(entries.map((e) => `${e.count}${e.type}`).join("+"));
  const { value: total, trace } = evaluate(ast, {}, serverRng, "roll");
  const expression = formatFormulaNode(ast);

  const sessionId = await getOrOpenSessionForCampaign(supabase, params.campaignId);
  const hidden = params.hidden && isAdmin;
  await insertDiceRoll(supabase, {
    sessionId,
    campaignId: params.campaignId,
    expression,
    ast: ast as unknown as Json,
    context: {} as unknown as Json,
    result: total,
    detail: { who: params.who, what: "Jet libre", chips: [], trace, dc: null, verdict: null } as unknown as Json,
    rolledBy: isAdmin ? "gm" : "player",
    visibilityLevel: hidden ? "gm" : "public",
  });

  return {
    ok: true,
    roll: { who: params.who, what: "Jet libre", chips: [], total, expression, dc: null, verdict: null, hidden, recorded: true, trace },
  };
}

/** V2-M11 : nom du PJ revendique par ce compte dans cette campagne, pour attribuer un jet libre — "MJ" si aucun (voir l'appelant). */
export async function getClaimedCharacterName(
  supabase: TypedClient,
  params: { campaignId: string; userId: string }
): Promise<string | null> {
  const entityId = await getClaimedCharacterEntityId(supabase, params);
  if (!entityId) return null;
  const entity = await getEntityById(supabase, entityId);
  return entity?.name ?? null;
}
