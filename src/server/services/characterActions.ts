import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import type { Locale } from "@/src/i18n/request";
import {
  characterSheet,
  type CharacterBuild,
  type DerivedSheet,
  type EquippedItem,
  type ResolvedFeature,
} from "@/src/core/rules/sheet";
import {
  resolveAttackRoll,
  resolveDamageRoll,
  weaponAttackAbilityMod,
  type AdvantageState,
  type AttackRollResult,
  type DamageRollResult,
} from "@/src/core/rules/action";
import { armorAcModifier, mapChosenSkillModifiers, type WeaponData } from "@/src/core/rules/srdMapping";
import { totalCarriedWeight } from "@/src/core/rules/encumbrance";
import { generateScalingTable, resolveScalingTarget } from "@/src/core/rules/scaling";
import { formatFormulaNode } from "@/src/core/formula/format";
import type { RuntimeStatePatch } from "@/src/core/rules/runtimeState";
import { zRuntimeState, type RuntimeState } from "@/src/core/schemas/runtimeState";
import type { CharacterBlockData } from "@/src/core/schemas/blocks/character";
import type { InventoryBlockData, InventoryItem } from "@/src/core/schemas/blocks/inventory";
import type { SpellcastingBlockData } from "@/src/core/schemas/blocks/spellcasting";
import type { ResourcesBlockData } from "@/src/core/schemas/blocks/resources";
import type { BlockReference } from "@/src/core/schemas/blocks/reference";
import type { EffectsBlockData, ScalingBlockData } from "@/src/core/schemas/rule-blocks/blocks";
import { getEntityById } from "@/src/server/repos/entities";
import { listBlocksForEntity } from "@/src/server/repos/blocks";
import { getRuntimeState as getRuntimeStateRow } from "@/src/server/repos/runtimeState";
import { getCampaignById } from "@/src/server/repos/campaigns";
import { getWorldDefaultRulesetId } from "@/src/server/repos/worlds";
import { insertDiceRoll } from "@/src/server/repos/diceRolls";
import { listBlocksForRulesetEntry, type RulesetEntryRow } from "@/src/server/repos/rules";
import { findEntryInRulesetChain } from "@/src/server/services/rules";
import { assembleResolvedRuleset, resolveEquipmentData } from "@/src/server/services/resolvedRuleset";
import { applyRuntimeStateChange, getEntityRuntimeState } from "@/src/server/services/runtimeState";
import { getOrOpenSessionForCampaign } from "@/src/server/services/sessions";
import { serverRng } from "@/src/server/services/rng";

type TypedClient = SupabaseClient<Database>;

function itemRef(item: InventoryItem): BlockReference | null {
  return (item as { ref?: BlockReference }).ref ?? null;
}
function itemLabel(item: InventoryItem): string {
  const label = (item as { label?: string }).label;
  if (label) return label;
  const ref = itemRef(item);
  if (ref) return ref.kind === "rule" ? ref.key : ref.id;
  return "";
}

export interface CharacterActionContext {
  entityId: string;
  worldId: string;
  campaignId: string | null;
  characterData: CharacterBlockData;
  inventoryData: InventoryBlockData | undefined;
  spellcastingData: SpellcastingBlockData | undefined;
  resourcesData: ResourcesBlockData | undefined;
  rulesetId: string;
  sheet: DerivedSheet;
  weaponByKey: Record<string, WeaponData | null>;
  /** Total de des de vie par de ("d10" -> 5), pour l'initialisation et les repos longs. */
  hitDiceTotals: Record<string, number>;
}

/**
 * Assemble tout ce dont une action de jeu a besoin (V1-B5) : le meme calcul
 * que `CharacterSheetPreview` (V1-B4), rejoue cote serveur plutot que de
 * faire confiance a une fiche derivee envoyee par le client — les des sont
 * lances par le serveur (CLAUDE.md regle 6), le modificateur qui s'y ajoute
 * doit l'etre aussi. `null` si l'entite n'a pas de bloc `character`, ou si
 * aucun ruleset n'est resolvable (monde sans ruleset par defaut, campagne
 * sans ruleset epingle).
 */
export async function resolveCharacterActionContext(
  supabase: TypedClient,
  entityId: string,
  campaignId: string | null,
  locale: Locale
): Promise<CharacterActionContext | null> {
  const entity = await getEntityById(supabase, entityId);
  if (!entity) return null;

  const campaign = campaignId ? await getCampaignById(supabase, campaignId) : null;
  const rulesetId = campaign?.ruleset_id ?? (await getWorldDefaultRulesetId(supabase, entity.world_id));
  if (!rulesetId) return null;

  const blocks = await listBlocksForEntity(supabase, entityId);
  const characterRow = blocks.find((b) => b.block_type === "character");
  if (!characterRow) return null;
  const characterData = characterRow.data as unknown as CharacterBlockData;

  const inventoryRow = blocks.find((b) => b.block_type === "inventory");
  const inventoryData = inventoryRow ? (inventoryRow.data as unknown as InventoryBlockData) : undefined;
  const spellcastingRow = blocks.find((b) => b.block_type === "spellcasting");
  const spellcastingData = spellcastingRow ? (spellcastingRow.data as unknown as SpellcastingBlockData) : undefined;
  const resourcesRow = blocks.find((b) => b.block_type === "resources");
  const resourcesData = resourcesRow ? (resourcesRow.data as unknown as ResourcesBlockData) : undefined;

  const speciesKey = characterData.species?.kind === "rule" ? characterData.species.key : undefined;
  const backgroundKey = characterData.background?.kind === "rule" ? characterData.background.key : undefined;
  const classSelections = characterData.classes
    .filter((c) => c.class.kind === "rule" && c.class.key)
    .map((c) => ({ key: (c.class as { kind: "rule"; key: string }).key, level: c.level }));

  const assembled = await assembleResolvedRuleset(
    supabase,
    rulesetId,
    { species: speciesKey, background: backgroundKey, classes: classSelections },
    locale
  );

  const equipmentKeys = (inventoryData?.items ?? [])
    .map(itemRef)
    .filter((r): r is { kind: "rule"; key: string } => r?.kind === "rule")
    .map((r) => r.key);
  const {
    armor: armorByKey,
    weapon: weaponByKey,
    weight: weightByKey,
  } = await resolveEquipmentData(supabase, rulesetId, equipmentKeys);
  const carriedWeight = totalCarriedWeight(inventoryData?.items ?? [], weightByKey);

  const dexScore = characterData.abilities.base.dex;
  const dexMod = Math.floor((dexScore - 10) / 2);
  const equippedItems: EquippedItem[] = (inventoryData?.items ?? []).map((item) => {
    const ref = itemRef(item);
    const armor = ref?.kind === "rule" ? armorByKey[ref.key] : null;
    return {
      key: item.id,
      label: itemLabel(item),
      equipped: item.equipped ?? false,
      modifiers: armor ? [armorAcModifier(armor, dexMod, `item:${item.id}`, itemLabel(item))] : [],
    };
  });

  const choiceFeatures: Record<string, ResolvedFeature> = {};
  const choiceFeatureKeys: string[] = [];
  for (const choice of assembled.remainingChoices) {
    const chosen = (characterData.choices[choice.id] as string[] | undefined) ?? [];
    const key = `choice:${choice.id}`;
    choiceFeatures[key] = {
      key,
      label: choice.label,
      source: "choice",
      modifiers: mapChosenSkillModifiers(chosen, choice.id, choice.label),
    };
    choiceFeatureKeys.push(key);
  }

  const build: CharacterBuild = {
    species: speciesKey ?? "",
    classes: characterData.classes
      .filter((c) => c.class.kind === "rule" && c.class.key)
      .map((c) => ({
        key: (c.class as { kind: "rule"; key: string }).key,
        level: c.level,
        subclass: c.subclass?.kind === "rule" ? c.subclass.key : undefined,
      })),
    abilities: { assigned: characterData.abilities.base },
    featureKeys: [...Object.keys(assembled.ruleset.features), ...choiceFeatureKeys],
  };

  const sheet = characterSheet(
    build,
    { classes: assembled.ruleset.classes, features: { ...assembled.ruleset.features, ...choiceFeatures } },
    equippedItems,
    [],
    carriedWeight
  );

  const hitDiceTotals: Record<string, number> = {};
  for (const cl of build.classes) {
    const hitDie = assembled.ruleset.classes[cl.key]?.hitDie;
    if (!hitDie) continue;
    const dieKey = `d${hitDie}`;
    hitDiceTotals[dieKey] = (hitDiceTotals[dieKey] ?? 0) + cl.level;
  }

  return {
    entityId,
    worldId: entity.world_id,
    campaignId,
    characterData,
    inventoryData,
    spellcastingData,
    resourcesData,
    rulesetId,
    sheet,
    weaponByKey,
    hitDiceTotals,
  };
}

export interface RuntimeStateView {
  state: RuntimeState;
  hpMax: number;
  hitDiceTotals: Record<string, number>;
}

/**
 * `entity_runtime_state` par defaut vaut `hp.current = 0` (V1-B3, aucune
 * ligne = etat zero) — correct pour un compteur jamais touche, faux pour
 * des PV : une fiche jamais ouverte afficherait "0/11". Sans ligne existante,
 * initialise PV au maximum et des de vie au complet, une seule fois,
 * jamais journalise (`sessionId: null`, acteur `system`) — ce n'est pas une
 * action du joueur, juste la valeur de depart.
 */
export async function getOrInitializeRuntimeState(
  supabase: TypedClient,
  ctx: CharacterActionContext
): Promise<RuntimeStateView> {
  const existingRow = await getRuntimeStateRow(supabase, ctx.entityId, ctx.campaignId);
  if (existingRow) {
    return { state: zRuntimeState.parse(existingRow.state), hpMax: ctx.sheet.hitPoints.max, hitDiceTotals: ctx.hitDiceTotals };
  }
  const state = await applyRuntimeStateChange(supabase, {
    entityId: ctx.entityId,
    campaignId: ctx.campaignId,
    patch: { hp: { current: ctx.sheet.hitPoints.max, temp: 0 }, hit_dice: ctx.hitDiceTotals },
    note: "Initialisation de l'etat de jeu",
    sessionId: null,
    actor: "system",
  });
  return { state, hpMax: ctx.sheet.hitPoints.max, hitDiceTotals: ctx.hitDiceTotals };
}

/**
 * Ecrit un jet dans `dice_rolls` (hors campagne : jet d'essai, non
 * enregistre — specs/module-joueur-et-solo.md n'existe qu'en V3, mais le
 * meme principe s'applique deja a la fiche jouable seule). Ouvre/reutilise
 * la session courante de la campagne (aucune gestion de seance ailleurs,
 * cf. services/sessions.ts).
 */
async function recordRoll(
  supabase: TypedClient,
  campaignId: string | null,
  roll: { expression: string; ast: unknown; context: Record<string, number>; result: number; detail: unknown }
): Promise<void> {
  if (!campaignId) return;
  const sessionId = await getOrOpenSessionForCampaign(supabase, campaignId);
  await insertDiceRoll(supabase, {
    sessionId,
    campaignId,
    expression: roll.expression,
    ast: roll.ast as Json,
    context: roll.context as unknown as Json,
    result: roll.result,
    detail: roll.detail as Json,
    rolledBy: "player",
  });
}

export type ActionErrorReason = "not_found" | "item_not_found" | "not_a_weapon";

export interface WeaponRollOutcome {
  weaponLabel: string;
  attack?: AttackRollResult;
  damage?: DamageRollResult;
  recorded: boolean;
}

/** Jet d'attaque d'une arme equipee (V1-B5). Le serveur relance la fiche derivee, jamais confiance en un modificateur envoye par le client. */
export async function rollWeaponAttack(
  supabase: TypedClient,
  params: { entityId: string; campaignId: string | null; itemId: string; advantage: AdvantageState; locale: Locale }
): Promise<WeaponRollOutcome | { error: ActionErrorReason }> {
  const ctx = await resolveCharacterActionContext(supabase, params.entityId, params.campaignId, params.locale);
  if (!ctx) return { error: "not_found" };

  const item = ctx.inventoryData?.items.find((i) => i.id === params.itemId);
  if (!item) return { error: "item_not_found" };
  const ref = itemRef(item);
  const weapon = ref?.kind === "rule" ? ctx.weaponByKey[ref.key] : null;
  if (!weapon) return { error: "not_a_weapon" };

  const abilityMod = weaponAttackAbilityMod(
    weapon.properties,
    weapon.isRanged,
    ctx.sheet.abilities.str.mod,
    ctx.sheet.abilities.dex.mod
  );
  // Decision de perimetre (V1-B5) : aucune maitrise d'arme n'est modelisee
  // par classe aujourd'hui (seulement competences/JS, cf. sheet.ts) — le
  // bonus de maitrise est toujours applique aux attaques d'arme.
  const attack = resolveAttackRoll(
    { abilityMod, proficiencyBonus: ctx.sheet.proficiencyBonus, proficient: true, advantage: params.advantage },
    serverRng
  );

  await recordRoll(supabase, params.campaignId, {
    expression: attack.expression,
    ast: attack.ast,
    context: { mod: abilityMod + ctx.sheet.proficiencyBonus },
    result: attack.total,
    detail: { trace: attack.trace, isCritical: attack.isCritical, isCriticalFail: attack.isCriticalFail, advantage: params.advantage },
  });

  return { weaponLabel: itemLabel(item), attack, recorded: params.campaignId !== null };
}

/** Jet de degats d'une arme equipee — `critical` vient du jet d'attaque precedent (l'appelant le sait deja). */
export async function rollWeaponDamage(
  supabase: TypedClient,
  params: { entityId: string; campaignId: string | null; itemId: string; critical: boolean; versatile: boolean; locale: Locale }
): Promise<WeaponRollOutcome | { error: ActionErrorReason }> {
  const ctx = await resolveCharacterActionContext(supabase, params.entityId, params.campaignId, params.locale);
  if (!ctx) return { error: "not_found" };

  const item = ctx.inventoryData?.items.find((i) => i.id === params.itemId);
  if (!item) return { error: "item_not_found" };
  const ref = itemRef(item);
  const weapon = ref?.kind === "rule" ? ctx.weaponByKey[ref.key] : null;
  if (!weapon) return { error: "not_a_weapon" };

  const formula = (params.versatile && weapon.versatileDamageDice) || weapon.damageDice;
  const abilityMod = weaponAttackAbilityMod(
    weapon.properties,
    weapon.isRanged,
    ctx.sheet.abilities.str.mod,
    ctx.sheet.abilities.dex.mod
  );

  const damage = resolveDamageRoll({ formula, abilityMod, critical: params.critical }, serverRng);

  await recordRoll(supabase, params.campaignId, {
    expression: damage.expression,
    ast: damage.ast,
    context: { mod: abilityMod },
    result: damage.total,
    detail: { trace: damage.trace, damageType: weapon.damageType, critical: params.critical },
  });

  return { weaponLabel: itemLabel(item), damage, recorded: params.campaignId !== null };
}

export interface CastSpellOutcome {
  slotLevelConsumed: number;
  remainingSlots: number;
  damage?: DamageRollResult;
}

/**
 * Lance un sort connu : decompte l'emplacement du niveau choisi et, si le
 * sort porte une formule de degats (bloc `effects`, mise a l'echelle par
 * `scaling` — V1-A1), la lance. Le jet d'attaque de sort (contre CA) ou
 * l'annonce d'un DD de sauvegarde restent hors perimetre de ce ticket :
 * specs/fiche-personnage-interactive.md §3 ne decrit que "choisir un
 * niveau, lancer et decompter".
 */
export async function castSpell(
  supabase: TypedClient,
  params: {
    entityId: string;
    campaignId: string | null;
    spellKey: string;
    slotLevel: number;
    actorUserId: string;
    locale: Locale;
  }
): Promise<CastSpellOutcome | { error: ActionErrorReason | "no_slot_available" }> {
  const ctx = await resolveCharacterActionContext(supabase, params.entityId, params.campaignId, params.locale);
  if (!ctx) return { error: "not_found" };
  if (!ctx.spellcastingData?.known.some((k) => k.ref.kind === "rule" && k.ref.key === params.spellKey)) {
    return { error: "item_not_found" };
  }

  const available = availableSlotsAt(ctx, params.slotLevel);
  const state = await getEntityRuntimeState(supabase, params.entityId, params.campaignId);
  const used = state.spell_slots_used[String(params.slotLevel)] ?? 0;
  if (used >= available) return { error: "no_slot_available" };

  let damage: DamageRollResult | undefined;
  const entry = await findEntryInRulesetChain(supabase, ctx.rulesetId, params.spellKey);
  if (entry) {
    const spellBlocks = await listBlocksForRulesetEntry(supabase, entry.id);
    const effectsBlock = spellBlocks.find((b) => b.block_type === "effects");
    const scalingBlock = spellBlocks.find((b) => b.block_type === "scaling");
    const effectsData = effectsBlock?.data as unknown as EffectsBlockData | undefined;
    const baseFormula = effectsData?.effects[0]?.formula;
    if (baseFormula) {
      const formulaText = scalingBlock
        ? resolveScaledFormula(scalingBlock.data as unknown as ScalingBlockData, params.slotLevel, effectsData, baseFormula)
        : formatFormulaNode(baseFormula);
      damage = resolveDamageRoll({ formula: formulaText, critical: false }, serverRng);
      await recordRoll(supabase, params.campaignId, {
        expression: damage.expression,
        ast: damage.ast,
        context: {},
        result: damage.total,
        detail: { trace: damage.trace, spellKey: params.spellKey, slotLevel: params.slotLevel },
      });
    }
  }

  const sessionId = params.campaignId ? await getOrOpenSessionForCampaign(supabase, params.campaignId) : null;
  await applyRuntimeStateChange(supabase, {
    entityId: params.entityId,
    campaignId: params.campaignId,
    patch: { spell_slots_used: { ...state.spell_slots_used, [String(params.slotLevel)]: used + 1 } },
    note: `Sort ${params.spellKey} lance (emplacement niveau ${params.slotLevel})`,
    sessionId,
    actor: "player",
    actorUserId: params.actorUserId,
  });

  return { slotLevelConsumed: params.slotLevel, remainingSlots: available - used - 1, damage };
}

/** `sheet.spellcasting.slots` est deja le resultat combine (characterSheet(), V1-B1) : rien a recombiner ici. */
function availableSlotsAt(ctx: CharacterActionContext, slotLevel: number): number {
  return ctx.sheet.spellcasting?.slots[slotLevel] ?? 0;
}

function resolveScaledFormula(
  scalingData: ScalingBlockData,
  slotLevel: number,
  effectsData: EffectsBlockData | undefined,
  baseFormula: import("@/src/core/formula/ast").FormulaNode
): string {
  const target = scalingData.rule?.target ? resolveScalingTarget(scalingData.rule.target, effectsData) : baseFormula;
  const table = generateScalingTable(scalingData, slotLevel, target ?? baseFormula);
  return table[String(slotLevel)] ?? formatFormulaNode(baseFormula);
}

export interface RestOutcome {
  hpHealed: number;
  hitDiceSpent: Record<string, number>;
}

/** Repos court : depense de des de vie au choix (soigne, decompte), recharge des ressources `short_rest`. */
export async function takeShortRest(
  supabase: TypedClient,
  params: { entityId: string; campaignId: string | null; hitDiceSpent: Record<string, number>; actorUserId: string; locale: Locale }
): Promise<RestOutcome | { error: ActionErrorReason }> {
  const ctx = await resolveCharacterActionContext(supabase, params.entityId, params.campaignId, params.locale);
  if (!ctx) return { error: "not_found" };

  const state = await getEntityRuntimeState(supabase, params.entityId, params.campaignId);
  // `ctx.hitDiceTotals` d'abord (complement total par de) puis `state.hit_dice`
  // par-dessus (restant reellement enregistre) : couvre a la fois la
  // premiere utilisation (aucune ligne en base, tout est disponible) et une
  // montee de niveau dans une nouvelle classe depuis le dernier repos (un
  // type de de present dans `hitDiceTotals` mais pas encore dans `state`).
  const currentHitDice = { ...ctx.hitDiceTotals, ...state.hit_dice };

  const conMod = ctx.sheet.abilities.con.mod;
  let hpHealed = 0;
  const nextHitDice: Record<string, number> = { ...currentHitDice };
  for (const [dieKey, count] of Object.entries(params.hitDiceSpent)) {
    if (count <= 0) continue;
    const remaining = currentHitDice[dieKey] ?? 0;
    const spend = Math.min(count, remaining);
    if (spend <= 0) continue;
    const faces = Number(dieKey.replace("d", ""));
    const roll = resolveDamageRoll({ formula: `${spend}d${faces}`, bonus: spend * conMod, critical: false }, serverRng);
    hpHealed += Math.max(0, roll.total);
    nextHitDice[dieKey] = remaining - spend;
    await recordRoll(supabase, params.campaignId, {
      expression: roll.expression,
      ast: roll.ast,
      context: { mod: spend * conMod },
      result: roll.total,
      detail: { trace: roll.trace, hitDice: dieKey, spent: spend },
    });
  }

  const sessionId = params.campaignId ? await getOrOpenSessionForCampaign(supabase, params.campaignId) : null;
  const maxHp = ctx.sheet.hitPoints.max;
  const patch: RuntimeStatePatch = {
    hit_dice: nextHitDice,
    hp: { current: Math.min(maxHp, state.hp.current + hpHealed) },
    resources: rechargeResources(ctx.resourcesData, state.resources, ["short_rest"]),
  };
  await applyRuntimeStateChange(supabase, {
    entityId: params.entityId,
    campaignId: params.campaignId,
    patch,
    note: `Repos court : ${hpHealed} PV soignes`,
    sessionId,
    actor: "player",
    actorUserId: params.actorUserId,
  });

  return { hpHealed, hitDiceSpent: params.hitDiceSpent };
}

/** Repos long : PV au maximum, moitie des des de vie recuperee, ressources et emplacements restaures, epuisement -1. */
export async function takeLongRest(
  supabase: TypedClient,
  params: { entityId: string; campaignId: string | null; actorUserId: string; locale: Locale }
): Promise<{ ok: true } | { error: ActionErrorReason }> {
  const ctx = await resolveCharacterActionContext(supabase, params.entityId, params.campaignId, params.locale);
  if (!ctx) return { error: "not_found" };

  const state = await getEntityRuntimeState(supabase, params.entityId, params.campaignId);
  // Meme fusion que takeShortRest : le complement total comble les types de
  // de absents de `state` (jamais initialise, ou nouvelle classe depuis le dernier repos).
  const currentHitDice = { ...ctx.hitDiceTotals, ...state.hit_dice };
  const nextHitDice: Record<string, number> = { ...currentHitDice };
  for (const [dieKey, total] of Object.entries(ctx.hitDiceTotals)) {
    const regained = Math.max(1, Math.floor(total / 2));
    nextHitDice[dieKey] = Math.min(total, (currentHitDice[dieKey] ?? 0) + regained);
  }

  const sessionId = params.campaignId ? await getOrOpenSessionForCampaign(supabase, params.campaignId) : null;
  await applyRuntimeStateChange(supabase, {
    entityId: params.entityId,
    campaignId: params.campaignId,
    patch: {
      hp: { current: ctx.sheet.hitPoints.max },
      hit_dice: nextHitDice,
      exhaustion: Math.max(0, state.exhaustion - 1),
      spell_slots_used: {},
      resources: rechargeResources(ctx.resourcesData, state.resources, ["short_rest", "long_rest"]),
    },
    note: "Repos long",
    sessionId,
    actor: "player",
    actorUserId: params.actorUserId,
  });

  return { ok: true };
}

function rechargeResources(
  resourcesData: ResourcesBlockData | undefined,
  current: Record<string, number>,
  recharges: readonly string[]
): Record<string, number> {
  const next = { ...current };
  for (const tracker of resourcesData?.trackers ?? []) {
    if (recharges.includes(tracker.recharge)) next[tracker.id] = 0;
  }
  return next;
}

/** PV courants +/- (bouton manuel de l'en-tete) — jamais un jet, une simple modification d'etat. */
export async function changeHp(
  supabase: TypedClient,
  params: { entityId: string; campaignId: string | null; delta: number; actorUserId: string }
): Promise<void> {
  const state = await getEntityRuntimeState(supabase, params.entityId, params.campaignId);
  const sessionId = params.campaignId ? await getOrOpenSessionForCampaign(supabase, params.campaignId) : null;
  await applyRuntimeStateChange(supabase, {
    entityId: params.entityId,
    campaignId: params.campaignId,
    patch: { hp: { current: Math.max(0, state.hp.current + params.delta) } },
    note: `PV ${params.delta >= 0 ? "+" : ""}${params.delta}`,
    sessionId,
    actor: "player",
    actorUserId: params.actorUserId,
  });
}

/** XP +N (bouton manuel de l'en-tete). */
export async function changeXp(
  supabase: TypedClient,
  params: { entityId: string; campaignId: string | null; delta: number; actorUserId: string }
): Promise<void> {
  const state = await getEntityRuntimeState(supabase, params.entityId, params.campaignId);
  const sessionId = params.campaignId ? await getOrOpenSessionForCampaign(supabase, params.campaignId) : null;
  await applyRuntimeStateChange(supabase, {
    entityId: params.entityId,
    campaignId: params.campaignId,
    patch: { xp: Math.max(0, state.xp + params.delta) },
    note: `XP ${params.delta >= 0 ? "+" : ""}${params.delta}`,
    sessionId,
    actor: "player",
    actorUserId: params.actorUserId,
  });
}

/** Epuisement +/- (bouton manuel de l'en-tete, V1-C4 suite) — clampe a [0, 6] comme `zRuntimeState.exhaustion`. */
export async function changeExhaustion(
  supabase: TypedClient,
  params: { entityId: string; campaignId: string | null; delta: number; actorUserId: string }
): Promise<void> {
  const state = await getEntityRuntimeState(supabase, params.entityId, params.campaignId);
  const sessionId = params.campaignId ? await getOrOpenSessionForCampaign(supabase, params.campaignId) : null;
  await applyRuntimeStateChange(supabase, {
    entityId: params.entityId,
    campaignId: params.campaignId,
    patch: { exhaustion: Math.max(0, Math.min(6, state.exhaustion + params.delta)) },
    note: `Épuisement ${params.delta >= 0 ? "+" : ""}${params.delta}`,
    sessionId,
    actor: "player",
    actorUserId: params.actorUserId,
  });
}

/** Consommation d'un compteur de ressource (onglet Actions) : +1 usage, ou une remise a une valeur precise (correction manuelle). */
export async function changeResourceUsage(
  supabase: TypedClient,
  params: { entityId: string; campaignId: string | null; trackerId: string; delta: number; actorUserId: string }
): Promise<void> {
  const state = await getEntityRuntimeState(supabase, params.entityId, params.campaignId);
  const current = state.resources[params.trackerId] ?? 0;
  const sessionId = params.campaignId ? await getOrOpenSessionForCampaign(supabase, params.campaignId) : null;
  await applyRuntimeStateChange(supabase, {
    entityId: params.entityId,
    campaignId: params.campaignId,
    patch: { resources: { ...state.resources, [params.trackerId]: Math.max(0, current + params.delta) } },
    note: `Ressource ${params.trackerId} ${params.delta >= 0 ? "+" : ""}${params.delta}`,
    sessionId,
    actor: "player",
    actorUserId: params.actorUserId,
  });
}

export type { RulesetEntryRow };
