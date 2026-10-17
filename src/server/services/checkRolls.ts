import { naturalD20FromTrace } from "@/src/core/dice/rollAttribution";
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import type { Locale } from "@/src/i18n/request";
import { ABILITY_LABELS, SKILL_ABILITIES, type Ability, type Skill, type Source } from "@/src/core/rules/sheet";
import { SKILL_LABELS_FR } from "@/src/i18n/fr";
import { resolveCheckRoll, type AdvantageState } from "@/src/core/rules/action";
import type { TraceStep } from "@/src/core/formula/evaluate";
import type { DieType } from "@/src/core/dice/roll";
import { advantagePairFromTrace, buildToolFormula, toolVerdict, type AdvantagePair } from "@/src/core/dice/diceTool";
import { parseFormula } from "@/src/core/formula/parser";
import { evaluate } from "@/src/core/formula/evaluate";
import { formatFormulaNode } from "@/src/core/formula/format";
import { resolveCharacterActionContext, getOrInitializeRuntimeState, changeInspiration } from "@/src/server/services/characterActions";
import { getEntityRuntimeState } from "@/src/server/services/runtimeState";
import { eventsForCheck, eventsForSave } from "@/src/core/rules/gameEvents";
import { fireTriggersForCharacter } from "@/src/server/services/triggerRuntime";
import type { DerivedSheet } from "@/src/core/rules/sheet";
import type { FiredEvent, ResolvedEffect } from "@/src/core/rules/triggers";
import type { CharacterActionContext } from "@/src/server/services/characterActions";
import { canUserEditEntityById, isWorldAdmin } from "@/src/server/services/permissions";
import { getEntityById, type EntitySummary } from "@/src/server/repos/entities";
import { getCampaignById, getClaimedCharacterEntityId } from "@/src/server/repos/campaigns";
import { insertDiceRoll, type DiceRollVisibility } from "@/src/server/repos/diceRolls";
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
  /** V3.1-33 : les deux d20 d'un jet avec avantage ou desavantage, et lequel est garde ; `null` sans avantage. */
  pair: AdvantagePair | null;
  /** V3.1-33 : le d20 garde (l'or d'une reussite au 20 naturel) ; `null` sans d20 unique. */
  naturalD20: number | null;
  /** V3.1-33 : DD prive du MJ — la valeur n'est rendue qu'a lui (cette reponse), jamais ecrite dans le jet que les joueurs lisent. */
  dcPrivate: boolean;
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
  /**
   * Jet secret. V3.1-33 (ADR 0038) : permis a tous — `gm` pour le MJ,
   * `roller` (le lanceur et le MJ) pour un joueur ; la RLS le garantit.
   */
  hidden: boolean;
  /** V3.1-33 : DD que les joueurs ne lisent pas. Ignore si l'appelant n'est pas MJ. */
  dcPrivate?: boolean;
  /** V3.1-33 : relance payee par l'Inspiration heroique — le libelle le dit. */
  reroll?: boolean;
  locale: Locale;
}

/** Qui lit un jet secret : le MJ seul s'il vient du MJ, sinon le lanceur et le MJ (V3.1-33, ADR 0038). */
export function secretVisibility(hidden: boolean, isAdmin: boolean): DiceRollVisibility {
  if (!hidden) return "public";
  return isAdmin ? "gm" : "roller";
}

const REROLL_SUFFIX = " — relance (Inspiration héroïque)";

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
    const runtime = emit.ctx.campaignId ? (await getOrInitializeRuntimeState(supabase, emit.ctx, { persist: true })).state : undefined;
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
    /** V3.1-89 : le personnage du jet et sa nature, pour les statistiques. */
    entityId: string;
    kind: "check" | "save";
    who: string;
    what: string;
    chips: Source[];
    advantage: AdvantageState;
    dc: number | null;
    hidden: boolean;
    isAdmin: boolean;
    dcPrivate: boolean;
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
      detail: {
        who: params.who,
        what: params.what,
        chips: params.chips,
        // DD prive : les joueurs lisent « contre DD ? », jamais la valeur (regle 5).
        dc: params.dcPrivate ? null : params.dc,
        ...(params.dcPrivate ? { dcPrivate: true } : {}),
        verdict,
        trace,
        ...(fired ? { triggers: fired } : {}),
      } as unknown as Json,
      rolledBy: "player",
      visibilityLevel: secretVisibility(params.hidden, params.isAdmin),
      attribution: { entityId: params.entityId, kind: params.kind, naturalD20: naturalD20FromTrace(trace) },
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
    pair: advantagePairFromTrace(trace),
    naturalD20: naturalD20FromTrace(trace) ?? null,
    dcPrivate: params.dcPrivate,
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
    entityId: check.entity.id,
    kind: "check",
    who: check.entity.name,
    what: `Test de ${ABILITY_LABELS[params.ability]}` + (params.reroll ? REROLL_SUFFIX : ""),
    chips,
    advantage: params.advantage,
    dc: params.dc,
    hidden: params.hidden,
    isAdmin,
    dcPrivate: (params.dcPrivate ?? false) && isAdmin,
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
    entityId: check.entity.id,
    kind: "check",
    who: check.entity.name,
    what: `${SKILL_LABELS_FR[params.skill]} — test de ${governingAbility}` + (params.reroll ? REROLL_SUFFIX : ""),
    chips: skillResult.sources,
    advantage: params.advantage,
    dc: params.dc,
    hidden: params.hidden,
    isAdmin,
    dcPrivate: (params.dcPrivate ?? false) && isAdmin,
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
    entityId: check.entity.id,
    kind: "save",
    who: check.entity.name,
    what: `Sauvegarde de ${ABILITY_LABELS[params.ability]}` + (params.reroll ? REROLL_SUFFIX : ""),
    chips: saveResult.sources,
    advantage: params.advantage,
    dc: params.dc,
    hidden: params.hidden,
    isAdmin,
    dcPrivate: (params.dcPrivate ?? false) && isAdmin,
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
    entityId: check.entity.id,
    kind: "check",
    who: check.entity.name,
    what: "Initiative",
    chips,
    advantage: params.advantage,
    dc: params.dc,
    hidden: params.hidden,
    isAdmin,
    dcPrivate: (params.dcPrivate ?? false) && isAdmin,
  });
  return { ok: true, roll };
}

export type HeroicRerollCheck = { kind: "ability"; ability: Ability } | { kind: "skill"; skill: Skill } | { kind: "save"; ability: Ability };
export type HeroicRerollResult = CheckRollResult | { ok: false; reason: "no_inspiration" };

/**
 * V3.1-33 — bande d'apres-jet (decision A du 5 octobre) : un test rate se
 * relance en depensant l'Inspiration heroique. Le serveur retire le point
 * PUIS lance le nouveau jet (regle 8) ; le client ne fournit ni valeur ni
 * resultat. Le point se depense meme quand l'interrupteur « inspiration »
 * des joueurs est coupe : c'est la regle qui le consomme, pas une
 * correction a la main (ADR 0043). « Une fois par jet » est tenu par
 * l'ecran ; le serveur, lui, ne laisse jamais depenser un point absent.
 */
export async function rerollWithHeroicInspiration(
  supabase: TypedClient,
  params: Omit<RollParams, "campaignId" | "reroll"> & { campaignId: string; check: HeroicRerollCheck }
): Promise<HeroicRerollResult> {
  const access = await requireCanRollForEntity(supabase, params);
  if (!access.ok) return access;
  const state = await getEntityRuntimeState(supabase, params.entityId, params.campaignId);
  if (state.inspiration < 1) return { ok: false, reason: "no_inspiration" };

  await changeInspiration(supabase, { entityId: params.entityId, campaignId: params.campaignId, delta: -1, actorUserId: params.callerId });

  const rollParams = { ...params, reroll: true };
  if (params.check.kind === "skill") return rollSkillCheck(supabase, { ...rollParams, skill: params.check.skill });
  if (params.check.kind === "save") return rollSavingThrow(supabase, { ...rollParams, ability: params.check.ability });
  return rollAbilityCheck(supabase, { ...rollParams, ability: params.check.ability });
}

export type FreeformRollErrorReason = "invalid_pool" | "advantage_needs_one_d20";
export type FreeformRollResult = { ok: true; roll: RollOutcome } | { ok: false; reason: FreeformRollErrorReason };

/**
 * Jet libre de l'outil de des (V2-M11, etendu par V3.1-33, ADR 0035) :
 * des empiles, modificateur, avantage / desavantage sur le d20, libelle, DD
 * et secret. Le serveur lance (regle 8) ; le client n'envoie jamais un
 * resultat. N'importe quel membre de la campagne peut en faire un (RLS
 * `dice_rolls_insert`) ; seul le MJ pose un DD prive.
 */
export async function rollFreeformCheck(
  supabase: TypedClient,
  params: {
    campaignId: string;
    callerId: string;
    pool: Partial<Record<DieType, number>>;
    who: string;
    hidden: boolean;
    modifier?: number;
    advantage?: AdvantageState;
    /** Le nom du bouton qui a pre-rempli l'outil (« Dague — touche ») ; « Jet libre » sinon. */
    label?: string | null;
    dc?: number | null;
    dcPrivate?: boolean;
  }
): Promise<FreeformRollResult> {
  const modifier = params.modifier ?? 0;
  const built = buildToolFormula({ pool: params.pool, modifier, advantage: params.advantage ?? "normal" });
  if (!built.ok) return { ok: false, reason: built.reason === "empty_pool" ? "invalid_pool" : built.reason };

  const campaign = await getCampaignById(supabase, params.campaignId);
  const isAdmin = campaign ? await isWorldAdmin(supabase, { worldId: campaign.world_id, userId: params.callerId }) : false;

  // meme moteur que les autres jets (formule -> AST -> evaluate), jamais un
  // calcul manuel parallele.
  const ast = parseFormula(built.formula);
  const { value: total, trace } = evaluate(ast, {}, serverRng, "roll");
  const expression = formatFormulaNode(ast);

  const dc = params.dc ?? null;
  const verdict = toolVerdict({ total, dc, hasD20: (params.pool.d20 ?? 0) > 0 });
  const dcPrivate = (params.dcPrivate ?? false) && isAdmin && dc !== null;
  const what = params.label?.trim() || "Jet libre";
  const chips: Source[] = modifier !== 0 ? [{ label: "Modificateur", value: modifier }] : [];
  const naturalD20 = naturalD20FromTrace(trace);

  // V3.1-89 : un jet libre va au personnage que le lanceur a réclamé dans
  // cette campagne ; sans personnage (le MJ), il n'est attribué à personne.
  const [sessionId, claimedEntityId] = await Promise.all([
    getOrOpenSessionForCampaign(supabase, params.campaignId),
    getClaimedCharacterEntityId(supabase, { campaignId: params.campaignId, userId: params.callerId }),
  ]);
  await insertDiceRoll(supabase, {
    sessionId,
    campaignId: params.campaignId,
    expression,
    ast: ast as unknown as Json,
    context: { modifier } as unknown as Json,
    result: total,
    detail: {
      who: params.who,
      what,
      chips,
      trace,
      dc: dcPrivate ? null : dc,
      ...(dcPrivate ? { dcPrivate: true } : {}),
      verdict,
    } as unknown as Json,
    rolledBy: isAdmin ? "gm" : "player",
    visibilityLevel: secretVisibility(params.hidden, isAdmin),
    attribution: { entityId: claimedEntityId, kind: "free", naturalD20 },
  });

  return {
    ok: true,
    roll: {
      who: params.who,
      what,
      chips,
      total,
      expression,
      dc,
      verdict,
      hidden: params.hidden,
      pair: advantagePairFromTrace(trace),
      naturalD20: naturalD20 ?? null,
      dcPrivate,
      recorded: true,
      trace,
    },
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
