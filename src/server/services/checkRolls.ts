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
import { resolveCharacterActionContext, getOrInitializeRuntimeState } from "@/src/server/services/characterActions";
import { eventsForCheck, eventsForSave } from "@/src/core/rules/gameEvents";
import { fireTriggersForCharacter } from "@/src/server/services/triggerRuntime";
import type { DerivedSheet } from "@/src/core/rules/sheet";
import type { FiredEvent, ResolvedEffect } from "@/src/core/rules/triggers";
import type { CharacterActionContext } from "@/src/server/services/characterActions";
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
  /**
   * V3-B2 : ce que ce jet a reveille, pour que la boucle de tour puisse
   * l'APPLIQUER. Absent presque toujours — il faut une fiche qui porte un
   * declencheur, un verdict et un DD. Les appelants plus anciens (boutons
   * de fiche, volet de des) l'ignorent : un jet isole ne change rien a la
   * partie, et c'est voulu.
   */
  triggers?: FiredForRoll;
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

/**
 * Ce qu'un jet a reveille. Rendu a l'appelant — la boucle de tour (V3-B2)
 * l'applique — ET consigne avec le jet dans `dice_rolls.detail`.
 */
export interface FiredForRoll {
  effects: ResolvedEffect[];
  failures: unknown[];
  rejected: unknown[];
  trace: string[];
}

/**
 * Fait partir les declencheurs d'un jet resolu, et rend de quoi les
 * consigner. `null` quand il n'y a rien a dire — le cas de loin le plus
 * frequent aujourd'hui, aucune fiche ne portant encore de declencheur.
 *
 * Les effets sont RENDUS, jamais appliques ici (V3-B2 s'en charge) : un
 * bouton de fiche qui lance un de ne doit pas changer la partie dans son
 * dos. Une panne ici n'emporte jamais le jet : le de a ete lance, son
 * resultat est acquis, et le perdre pour une regle maison cassee serait le
 * pire des echanges.
 */
/** Exportee pour V3-B5 (`turnIntent.resolveIntentRequest`) : le chemin "annoncé/volet" fait partir les mêmes déclencheurs que le chemin "fiche", jamais une seconde implémentation. */
export async function fireForRoll(
  supabase: TypedClient,
  emit: { ctx: CharacterActionContext; sheet: DerivedSheet; events: (p: boolean, t: number, d: number) => FiredEvent[] } | undefined,
  verdict: "success" | "fail" | null,
  total: number,
  dc: number | null
): Promise<FiredForRoll | null> {
  if (!emit || verdict === null || dc === null) return null;
  const [event] = emit.events(verdict === "success", total, dc);
  if (!event) return null;

  try {
    const runtime = emit.ctx.campaignId ? (await getOrInitializeRuntimeState(supabase, emit.ctx)).state : undefined;
    const out = await fireTriggersForCharacter(supabase, {
      rulesetId: emit.ctx.rulesetId,
      subject: emit.ctx.entityId,
      sheet: emit.sheet,
      runtime,
      event,
    });
    if (out.effects.length === 0 && out.failures.length === 0 && out.rejected.length === 0) return null;
    return { effects: out.effects, failures: out.failures, rejected: out.rejected, trace: out.trace };
  } catch (err) {
    // Jamais muet (CLAUDE.md) : consigne avec le jet, et le jet survit.
    return { effects: [], failures: [{ reason: err instanceof Error ? err.message : String(err) }], rejected: [], trace: [] };
  }
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
    /**
     * V3-A2 : ce que ce jet EMET une fois resolu. Absent pour un jet libre
     * ou sans DD — sans verdict, il n'y a ni reussite ni echec a annoncer.
     * Le moteur de declencheurs part ICI plutot que chez chaque appelant :
     * un seul endroit ou un jet devient un evenement.
     */
    emit?: {
      ctx: CharacterActionContext;
      sheet: DerivedSheet;
      events: (passed: boolean, total: number, dc: number) => FiredEvent[];
    };
  }
): Promise<RollOutcome> {
  const modifier = params.chips.reduce((sum, c) => sum + c.value, 0);
  const { total, ast, expression, trace } = resolveCheckRoll({ modifier, advantage: params.advantage }, serverRng);
  const verdict = verdictFor(total, params.dc);

  // Les declencheurs partent AVANT l'enregistrement, pour que leur sortie
  // parte avec le jet dans le journal : un jet et ce qu'il a reveille se
  // relisent ensemble, jamais dans deux lignes a recoller.
  const fired = await fireForRoll(supabase, params.emit, verdict, total, params.dc);

  if (params.campaignId) {
    const sessionId = await getOrOpenSessionForCampaign(supabase, params.campaignId);
    await insertDiceRoll(supabase, {
      sessionId,
      campaignId: params.campaignId,
      expression,
      ast: ast as unknown as Json,
      context: { modifier } as unknown as Json,
      result: total,
      detail: { who: params.who, what: params.what, chips: params.chips, dc: params.dc, verdict, trace, ...(fired ? { triggers: fired } : {}) } as unknown as Json,
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
    ...(fired ? { triggers: fired } : {}),
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
    emit: {
      ctx,
      sheet: ctx.sheet,
      events: (passed, total, dc) =>
        eventsForCheck({ who: ctx.entityId, kind: "ability", key: params.ability, ability: params.ability, passed, total, dc }),
    },
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
    emit: {
      ctx,
      sheet: ctx.sheet,
      events: (passed, total, dc) =>
        eventsForCheck({
          who: ctx.entityId,
          kind: "skill",
          key: params.skill,
          ability: SKILL_ABILITIES[params.skill],
          passed,
          total,
          dc,
        }),
    },
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
    emit: {
      ctx,
      sheet: ctx.sheet,
      events: (passed, total, dc) => eventsForSave({ who: ctx.entityId, passed, total, dc }),
    },
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
