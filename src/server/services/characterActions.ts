import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import type { Locale } from "@/src/i18n/request";
import {
  ABILITIES,
  characterSheet,
  resolveHpGain,
  type Ability,
  type CharacterBuild,
  type DerivedSheet,
  type EquippedItem,
  type HpGainChoice,
  type ResolvedClass,
  type ResolvedFeature,
} from "@/src/core/rules/sheet";
import { hasReachedNextLevel } from "@/src/core/rules/experience";
import { asiExceedsCap, asiModifiers, isValidAsiChoice, parseAsiChoice, type AsiChoice } from "@/src/core/rules/abilityScoreImprovement";
import { checkMulticlassEntry, exceedsLevelCap, withinAbilityScoreCap } from "@/src/core/rules/characterRules";
import { isWorldAdmin } from "@/src/server/services/permissions";
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
import { resolveScaledFormulaText } from "@/src/core/rules/scaling";
import { formatFormulaNode } from "@/src/core/formula/format";
import { mergeRuntimeState, type RuntimeStatePatch } from "@/src/core/rules/runtimeState";
import { defaultRuntimeState, zRuntimeState, type RuntimeState } from "@/src/core/schemas/runtimeState";
import type { CharacterBlockData } from "@/src/core/schemas/blocks/character";
import type { InventoryBlockData, InventoryItem } from "@/src/core/schemas/blocks/inventory";
import type { SpellcastingBlockData } from "@/src/core/schemas/blocks/spellcasting";
import type { ResourcesBlockData } from "@/src/core/schemas/blocks/resources";
import type { BlockReference } from "@/src/core/schemas/blocks/reference";
import type { EffectsBlockData, ScalingBlockData } from "@/src/core/schemas/rule-blocks/blocks";
import { advanceSceneTime } from "@/src/core/rules/scene";
import { getSceneState, putSceneState } from "@/src/server/repos/sceneStates";
import { getEntityById } from "@/src/server/repos/entities";
import { insertBlock, listBlocksForEntity, updateBlockWithVersionCheck, type BlockRow } from "@/src/server/repos/blocks";
import { defaultBlockDisplay } from "@/src/core/schemas/blocks/registry";
import { getRuntimeState as getRuntimeStateRow } from "@/src/server/repos/runtimeState";
import { getCampaignById } from "@/src/server/repos/campaigns";
import { getWorldDefaultRulesetId } from "@/src/server/repos/worlds";
import { insertDiceRoll } from "@/src/server/repos/diceRolls";
import { listBlocksForRulesetEntry, type RulesetEntryRow } from "@/src/server/repos/rules";
import { entryNameFrom, findEntryInRulesetChain } from "@/src/server/services/rules";
import { assembleResolvedRuleset, resolveCharacterChoices, resolveEquipmentData, type RemainingChoice } from "@/src/server/services/resolvedRuleset";
import { applyRuntimeStateChange, getEntityRuntimeState } from "@/src/server/services/runtimeState";
import { getOrOpenSessionForCampaign } from "@/src/server/services/sessions";
import { serverRng } from "@/src/server/services/rng";
import { fireTriggersForCharacter } from "@/src/server/services/triggerRuntime";
import { applyRestEffects, clearedSpellSlots } from "@/src/core/rules/restEffects";
import { applyDamageWithDeath, applyHealing, type DeathState } from "@/src/core/rules/deathSaves";
import { grantTempHp, type TempHpChoice } from "@/src/core/rules/tempHp";
import { zSpellCastingBlockData } from "@/src/core/schemas/rule-blocks/blocks";
import { setConcentration } from "@/src/server/services/concentration";
import type { Concentration } from "@/src/core/schemas/runtimeState";

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

const ASI_CHOICE_KEY = /^(.+)\.l(\d+)\.asi$/;

/**
 * Reconstruit les `ResolvedFeature` synthetiques pour chaque choix d'ASI
 * deja enregistre dans `character.choices` (V2-G1) — sans cet appel dans
 * `resolveCharacterActionContext`, un bonus d'ASI deja applique resterait
 * invisible a TOUT calcul serveur (jets d'attaque, CA de sort, `/sheet`),
 * puisque seule `applyLevelUp` construisait cette feature jusqu'ici. Un
 * choix invalide (donnee corrompue, ruleset change depuis) est ignore en
 * silence ici — un jet de combat ne doit jamais echouer a cause d'un vieux
 * choix illisible ; `applyLevelUp`, lui, reste strict sur ses PROPRES
 * validations a l'ecriture (voir plus bas).
 */
function buildAsiChoiceFeatures(
  choices: CharacterBlockData["choices"],
  asiGrantedLevels: Record<string, number[]>,
  classes: Record<string, ResolvedClass>
): { features: Record<string, ResolvedFeature>; keys: string[] } {
  const features: Record<string, ResolvedFeature> = {};
  const keys: string[] = [];
  for (const [choiceKey, rawValue] of Object.entries(choices)) {
    const match = ASI_CHOICE_KEY.exec(choiceKey);
    if (!match) continue;
    const [, classKey, levelText] = match;
    const asi = parseAsiChoice(rawValue);
    if (!asi || !isValidAsiChoice(asi)) continue;
    if (!(asiGrantedLevels[classKey] ?? []).includes(Number(levelText))) continue;
    const key = `choice:${choiceKey}`;
    const label = `Amélioration de caractéristique (${classes[classKey]?.label ?? classKey} niv. ${levelText})`;
    features[key] = { key, label, source: `asi:${choiceKey}`, modifiers: asiModifiers(asi, `asi:${choiceKey}`, label) };
    keys.push(key);
  }
  return { features, keys };
}

export interface CharacterActionContext {
  entityId: string;
  /** V2-M11 (volet de lancer de des) : attribution du jet ("qui a lance") sans relire l'entite a chaque site d'appel. */
  entityName: string;
  worldId: string;
  campaignId: string | null;
  characterData: CharacterBlockData;
  /** Ligne brute du bloc `character` (id/version/visibilite) — necessaire pour le repatcher (V2-G1, remise a zero de la maitrise d'armes au repos long), jamais pour son seul contenu deja porte par `characterData`. */
  characterBlockRow: BlockRow;
  inventoryData: InventoryBlockData | undefined;
  spellcastingData: SpellcastingBlockData | undefined;
  resourcesData: ResourcesBlockData | undefined;
  rulesetId: string;
  sheet: DerivedSheet;
  weaponByKey: Record<string, WeaponData | null>;
  /** Total de des de vie par de ("d10" -> 5), pour l'initialisation et les repos longs. */
  hitDiceTotals: Record<string, number>;
  /** Choix non resolus (competences/langues/maitrise d'armes) du personnage — V2-G1, necessaire au repos long pour retrouver les cles de maitrise d'armes a effacer. */
  remainingChoices: RemainingChoice[];
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
  // V3.1-62 (docs/CABLAGE.md, C3) : la fiche, ses blocs et la campagne ne
  // dependent pas les uns des autres — une seule vague au lieu de trois.
  const [entity, campaign, blocks] = await Promise.all([
    getEntityById(supabase, entityId),
    campaignId ? getCampaignById(supabase, campaignId) : Promise.resolve(null),
    listBlocksForEntity(supabase, entityId),
  ]);
  if (!entity) return null;

  const rulesetId = campaign?.ruleset_id ?? (await getWorldDefaultRulesetId(supabase, entity.world_id));
  if (!rulesetId) return null;

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

  const equipmentKeys = (inventoryData?.items ?? [])
    .map(itemRef)
    .filter((r): r is { kind: "rule"; key: string } => r?.kind === "rule")
    .map((r) => r.key);
  // Le ruleset assemble et l'equipement ne dependent pas l'un de l'autre (V3.1-62, C3).
  const [assembled, { armor: armorByKey, weapon: weaponByKey, weight: weightByKey }] = await Promise.all([
    assembleResolvedRuleset(
      supabase,
      rulesetId,
      { species: speciesKey, background: backgroundKey, classes: classSelections, choices: characterData.choices },
      locale
    ),
    resolveEquipmentData(supabase, rulesetId, equipmentKeys),
  ]);
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

  // V3.1-116 : les choix accordés (lignages, dons, Compétent…), résolus avec
  // les réponses du personnage et ses sorts validés. Leurs effets remplacent
  // ceux de l'ancienne boucle pour les mêmes clés.
  const characterLevel = Math.max(1, classSelections.reduce((sum, c) => sum + c.level, 0));
  const grantedChoices = await resolveCharacterChoices(supabase, rulesetId, assembled, characterData.choices, characterLevel);
  const grantedChoiceKeys = new Set(grantedChoices.open.map((c) => c.key));

  const choiceFeatures: Record<string, ResolvedFeature> = {};
  const choiceFeatureKeys: string[] = [];
  for (const choice of assembled.remainingChoices) {
    if (grantedChoiceKeys.has(choice.id)) continue;
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
  for (const feature of grantedChoices.features) {
    choiceFeatures[feature.key] = feature;
    choiceFeatureKeys.push(feature.key);
  }
  const asiFeatures = buildAsiChoiceFeatures(characterData.choices, assembled.asiGrantedLevels, assembled.ruleset.classes);
  Object.assign(choiceFeatures, asiFeatures.features);
  choiceFeatureKeys.push(...asiFeatures.keys);

  const build: CharacterBuild = {
    species: speciesKey ?? "",
    classes: characterData.classes
      .filter((c) => c.class.kind === "rule" && c.class.key)
      .map((c) => ({
        key: (c.class as { kind: "rule"; key: string }).key,
        level: c.level,
        subclass: c.subclass?.kind === "rule" ? c.subclass.key : undefined,
        hpRolls: c.hp_rolls,
      })),
    abilities: { assigned: characterData.abilities.base },
    featureKeys: [...Object.keys(assembled.ruleset.features), ...choiceFeatureKeys],
  };

  const sheet = characterSheet(
    build,
    // V3.1-115 : plafond de caracteristique et charge lus dans les regles du ruleset.
    { classes: assembled.ruleset.classes, features: { ...assembled.ruleset.features, ...choiceFeatures }, characterRules: assembled.ruleset.characterRules },
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
    entityName: entity.name,
    worldId: entity.world_id,
    campaignId,
    characterData,
    characterBlockRow: characterRow,
    inventoryData,
    spellcastingData,
    resourcesData,
    rulesetId,
    sheet,
    weaponByKey,
    hitDiceTotals,
    remainingChoices: assembled.remainingChoices,
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
  ctx: CharacterActionContext,
  options: { persist: boolean }
): Promise<RuntimeStateView> {
  const existingRow = await getRuntimeStateRow(supabase, ctx.entityId, ctx.campaignId);
  if (existingRow) {
    return { state: zRuntimeState.parse(existingRow.state), hpMax: ctx.sheet.hitPoints.max, hitDiceTotals: ctx.hitDiceTotals };
  }
  const initialPatch: RuntimeStatePatch = { hp: { current: ctx.sheet.hitPoints.max, temp: 0 }, hit_dice: ctx.hitDiceTotals };
  // V3.1-108 : seul qui peut editer la fiche ecrit son etat (RLS). Un
  // lecteur voit la meme valeur de depart, calculee sans etre enregistree.
  if (!options.persist) {
    return { state: mergeRuntimeState(defaultRuntimeState(), initialPatch), hpMax: ctx.sheet.hitPoints.max, hitDiceTotals: ctx.hitDiceTotals };
  }
  const state = await applyRuntimeStateChange(supabase, {
    entityId: ctx.entityId,
    campaignId: ctx.campaignId,
    patch: initialPatch,
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
    // Boutons d'action de la fiche (attaque/degats) : toujours publics —
    // le "jet cache" (V2-M11) n'existe que depuis le volet de lancer de
    // des, jamais depuis ce chemin plus ancien.
    visibilityLevel: "public",
    rolledBy: "player",
  });
}

export type ActionErrorReason = "not_found" | "item_not_found" | "not_a_weapon" | "not_a_spellcaster";

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
    detail: {
      who: ctx.entityName,
      what: `Attaque — ${itemLabel(item)}`,
      trace: attack.trace,
      isCritical: attack.isCritical,
      isCriticalFail: attack.isCriticalFail,
      advantage: params.advantage,
    },
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
    detail: {
      who: ctx.entityName,
      what: `Degats — ${itemLabel(item)}`,
      trace: damage.trace,
      damageType: weapon.damageType,
      critical: params.critical,
    },
  });

  return { weaponLabel: itemLabel(item), damage, recorded: params.campaignId !== null };
}

export interface CastSpellOutcome {
  slotLevelConsumed: number;
  remainingSlots: number;
  damage?: DamageRollResult;
  /** V3.1-24 : présent seulement pour un sort de concentration — la concentration posée, et celle qu'elle a remplacée (rompue) s'il y en avait une. */
  concentration?: { current: Concentration; broken: Concentration | null };
}

/** Jet d'attaque de sort (retour utilisateur, boutons d'action des sorts — meme motif que `rollWeaponAttack`) : 1d20 + `sheet.spellcasting.attackBonus`, deja la somme caracteristique+maitrise (V1-B1) — jamais recompose ici. */
export async function rollSpellAttack(
  supabase: TypedClient,
  params: { entityId: string; campaignId: string | null; spellKey: string; advantage: AdvantageState; locale: Locale }
): Promise<{ attack: AttackRollResult; recorded: boolean } | { error: ActionErrorReason }> {
  const ctx = await resolveCharacterActionContext(supabase, params.entityId, params.campaignId, params.locale);
  if (!ctx) return { error: "not_found" };
  if (!ctx.spellcastingData?.known.some((k) => k.ref.kind === "rule" && k.ref.key === params.spellKey)) {
    return { error: "item_not_found" };
  }
  if (!ctx.sheet.spellcasting) return { error: "not_a_spellcaster" };

  const attack = resolveAttackRoll(
    { abilityMod: ctx.sheet.spellcasting.attackBonus, proficiencyBonus: 0, proficient: false, advantage: params.advantage },
    serverRng
  );

  await recordRoll(supabase, params.campaignId, {
    expression: attack.expression,
    ast: attack.ast,
    context: { mod: ctx.sheet.spellcasting.attackBonus },
    result: attack.total,
    detail: {
      who: ctx.entityName,
      what: `Attaque de sort — ${params.spellKey}`,
      trace: attack.trace,
      isCritical: attack.isCritical,
      isCriticalFail: attack.isCriticalFail,
      advantage: params.advantage,
      spellKey: params.spellKey,
    },
  });

  return { attack, recorded: params.campaignId !== null };
}

/**
 * Lance un sort connu : decompte l'emplacement du niveau choisi et, si le
 * sort porte une formule de degats (bloc `effects`, mise a l'echelle par
 * `scaling` — V1-A1), la lance. `critical` vient du jet d'attaque de sort
 * precedent (`rollSpellAttack` ci-dessus, meme motif que
 * `rollWeaponDamage`/`critical`) — seuls les sorts a attaque en ont un,
 * jamais applique a un sort a sauvegarde (regle 2024 : un coup critique ne
 * touche que les jets d'attaque).
 */
export async function castSpell(
  supabase: TypedClient,
  params: {
    entityId: string;
    campaignId: string | null;
    spellKey: string;
    slotLevel: number;
    critical: boolean;
    actorUserId: string;
    locale: Locale;
  }
): Promise<CastSpellOutcome | { error: ActionErrorReason | "no_slot_available" }> {
  const ctx = await resolveCharacterActionContext(supabase, params.entityId, params.campaignId, params.locale);
  if (!ctx) return { error: "not_found" };
  if (!ctx.spellcastingData?.known.some((k) => k.ref.kind === "rule" && k.ref.key === params.spellKey)) {
    return { error: "item_not_found" };
  }

  // Sort mineur (retour utilisateur, V2-G1 suite) : `slotLevel: 0` ne
  // consomme jamais d'emplacement (regle 2024, toujours disponible) — ni
  // verification de disponibilite, ni decompte d'etat d'execution, seul le
  // jet de degats eventuel (identique a un sort normal) s'applique plus bas.
  const isCantrip = params.slotLevel === 0;
  let available = 0;
  let used = 0;
  let state: Awaited<ReturnType<typeof getEntityRuntimeState>> | null = null;
  if (!isCantrip) {
    available = availableSlotsAt(ctx, params.slotLevel);
    state = await getEntityRuntimeState(supabase, params.entityId, params.campaignId);
    used = state.spell_slots_used[String(params.slotLevel)] ?? 0;
    if (used >= available) return { error: "no_slot_available" };
  }

  let damage: DamageRollResult | undefined;
  // V3.1-24 : un sort de concentration la pose. `spell_casting.concentration`
  // est lu avec les blocs deja charges pour les degats — aucune lecture de plus.
  let concentrationToStart: Concentration | null = null;
  const entry = await findEntryInRulesetChain(supabase, ctx.rulesetId, params.spellKey);
  if (entry) {
    const spellBlocks = await listBlocksForRulesetEntry(supabase, entry.id);
    const casting = zSpellCastingBlockData.safeParse(spellBlocks.find((b) => b.block_type === "spell_casting")?.data);
    if (casting.success && casting.data.concentration) {
      concentrationToStart = { spell_key: params.spellKey, label: entryNameFrom(entry) };
    }
    const effectsBlock = spellBlocks.find((b) => b.block_type === "effects");
    const scalingBlock = spellBlocks.find((b) => b.block_type === "scaling");
    const effectsData = effectsBlock?.data as unknown as EffectsBlockData | undefined;
    const baseFormula = effectsData?.effects[0]?.formula;
    if (baseFormula) {
      const formulaText = scalingBlock
        ? resolveScaledFormulaText(scalingBlock.data as unknown as ScalingBlockData, params.slotLevel, effectsData, baseFormula)
        : formatFormulaNode(baseFormula);
      damage = resolveDamageRoll({ formula: formulaText, critical: params.critical }, serverRng);
      await recordRoll(supabase, params.campaignId, {
        expression: damage.expression,
        ast: damage.ast,
        context: {},
        result: damage.total,
        detail: {
          who: ctx.entityName,
          what: `Sort — ${params.spellKey}`,
          trace: damage.trace,
          spellKey: params.spellKey,
          slotLevel: params.slotLevel,
        },
      });
    }
  }

  if (!isCantrip && state) {
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
  }

  let concentration: CastSpellOutcome["concentration"];
  if (concentrationToStart) {
    // Le seul chemin qui change une concentration (`setConcentration`) : la
    // precedente est remplacee et rendue comme rompue (V3.1-130 s'y branchera).
    const change = await setConcentration(supabase, {
      entityId: params.entityId,
      campaignId: params.campaignId,
      incoming: concentrationToStart,
      actorUserId: params.actorUserId,
    });
    if (change.next) concentration = { current: change.next, broken: change.broken };
  }

  return { slotLevelConsumed: params.slotLevel, remainingSlots: isCantrip ? 0 : available - used - 1, damage, concentration };
}

/** `sheet.spellcasting.slots` est deja le resultat combine (characterSheet(), V1-B1) : rien a recombiner ici. */
function availableSlotsAt(ctx: CharacterActionContext, slotLevel: number): number {
  return ctx.sheet.spellcasting?.slots[slotLevel] ?? 0;
}

export interface RestOutcome {
  hpHealed: number;
  hitDiceSpent: Record<string, number>;
}

/**
 * V3-C6 — « L'heure avance selon l'action ... un repos » (specs/moteur-de-jeu.md
 * §6, docs/BACKLOG_V3.md). Une durée D&D non ambigue, contrairement a une
 * action libre : un repos court dure une heure, un repos long huit heures,
 * quel que soit ce que le joueur a tape. Sans scene posee, rien a avancer —
 * hors campagne ou avant que le premier lieu soit choisi, un repos reste
 * valide, juste sans horloge a tenir (meme repli que `playTurn`).
 */
const SHORT_REST_MINUTES = 60;
const LONG_REST_MINUTES = 8 * 60;

async function advanceSceneClockForRest(supabase: TypedClient, campaignId: string | null, minutes: number, callerId: string): Promise<void> {
  if (!campaignId) return;
  const scene = await getSceneState(supabase, campaignId);
  if (!scene) return;
  await putSceneState(supabase, { campaignId, state: advanceSceneTime(scene, minutes), updatedBy: callerId });
}

/**
 * V3.1-24 : un repos qui rend des PV est un soin comme un autre (ADR 0036 §8) —
 * il remet les jets contre la mort a zero et retire Inconscient a qui etait a 0 PV.
 */
function healedByRest(state: RuntimeState, hpMax: number, nextCurrent: number): RuntimeStatePatch {
  const healed = applyHealing(
    { hp: { current: state.hp.current, max: hpMax, temp: state.hp.temp }, conditions: state.conditions, deathSaves: state.death_saves },
    nextCurrent - state.hp.current
  );
  return { hp: { current: nextCurrent }, conditions: healed.conditions, death_saves: healed.deathSaves };
}

/** Repos court : depense de des de vie au choix (soigne, decompte), recharge des ressources `short_rest`. */
/**
 * ADR 0036 §7 et ADR 0050 (V3.1-5) — un repos emet son evenement APRES ses
 * effets de base, et applique ce que ses declencheurs rendent (« Ingenieux » :
 * l'inspiration au repos long). Calcule sur l'etat d'apres repos, pour une
 * seule ecriture ; rend le patch complementaire et les lignes de la note.
 * Un declencheur qui echoue ou un effet ignore est consigne, jamais muet ;
 * le repos, lui, a lieu quoi qu'il arrive.
 */
async function restTriggersPatch(
  supabase: TypedClient,
  ctx: CharacterActionContext,
  rested: RuntimeState,
  event: "short_rest" | "long_rest"
): Promise<{ patch: RuntimeStatePatch; notes: string[] }> {
  try {
    // Un repos n'a qu'un acteur : le personnage, sous le nom `self` qu'emploient
    // les declencheurs (formulaires, donnees SRD).
    const out = await fireTriggersForCharacter(supabase, {
      rulesetId: ctx.rulesetId,
      subject: "self",
      sheet: ctx.sheet,
      runtime: rested,
      event: { event, subject: "self" },
    });
    const result = applyRestEffects(rested, out.effects, { hpMax: ctx.sheet.hitPoints.max, inspirationMax: 1 });
    const notes = [
      ...result.applied,
      ...result.ignored.map((i) => `Effet ignoré (${i.action}) : ${i.reason}`),
      ...out.failures.map((f) => `Déclencheur en échec : ${f.reason}`),
      ...out.rejected.map((r) => `Déclencheur rejeté (${r.entryKey}) : ${r.reason}`),
      ...(out.error ? [`Déclencheurs interrompus : ${out.error.message}`] : []),
    ];
    return {
      patch: { hp: { current: result.state.hp.current }, conditions: result.state.conditions, inspiration: result.state.inspiration },
      notes,
    };
  } catch (err) {
    return { patch: {}, notes: [`Déclencheurs du repos en échec : ${err instanceof Error ? err.message : String(err)}`] };
  }
}

function restNote(base: string, notes: readonly string[]): string {
  return notes.length === 0 ? base : `${base} — ${notes.join(" ; ")}`;
}

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
      detail: { who: ctx.entityName, what: `Repos — de de vie (${dieKey})`, trace: roll.trace, hitDice: dieKey, spent: spend },
    });
  }

  const sessionId = params.campaignId ? await getOrOpenSessionForCampaign(supabase, params.campaignId) : null;
  const maxHp = ctx.sheet.hitPoints.max;
  const basePatch: RuntimeStatePatch = {
    hit_dice: nextHitDice,
    ...healedByRest(state, maxHp, Math.min(maxHp, state.hp.current + hpHealed)),
    resources: rechargeResources(ctx.resourcesData, state.resources, ["short_rest"]),
  };
  const triggered = await restTriggersPatch(supabase, ctx, mergeRuntimeState(state, basePatch), "short_rest");
  await applyRuntimeStateChange(supabase, {
    entityId: params.entityId,
    campaignId: params.campaignId,
    patch: { ...basePatch, ...triggered.patch },
    note: restNote(`Repos court : ${hpHealed} PV soignes`, triggered.notes),
    sessionId,
    actor: "player",
    actorUserId: params.actorUserId,
  });
  await advanceSceneClockForRest(supabase, params.campaignId, SHORT_REST_MINUTES, params.actorUserId);

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

  // Maitrise d'armes remise a zero a chaque repos long (retour utilisateur,
  // V2-G1 : "une fois qu'il valide un long repos, ce choix se remet a
  // zero") — texte SRD 2024 ("Whenever you finish a Long Rest...") simplifie
  // ici en repli complet plutot qu'un "changer une seule arme" plus fidele
  // mais plus complexe a interfacer, choix explicite de l'utilisateur. Ecrit
  // directement dans le bloc `character` (`choices`), pas dans
  // `entity_runtime_state` : reutilise le meme stockage que le choix initial
  // de l'assistant de creation plutot que d'ouvrir un second mecanisme de
  // persistance pour la meme donnee.
  const weaponMasteryChoiceIds = ctx.remainingChoices.filter((c) => c.kind === "weapon_mastery").map((c) => c.id);
  if (weaponMasteryChoiceIds.some((id) => id in ctx.characterData.choices)) {
    const nextChoices = { ...ctx.characterData.choices };
    for (const id of weaponMasteryChoiceIds) delete nextChoices[id];
    await updateBlockWithVersionCheck(supabase, {
      id: ctx.characterBlockRow.id,
      expectedVersion: ctx.characterBlockRow.version,
      display: ctx.characterBlockRow.display,
      data: { ...ctx.characterData, choices: nextChoices } as unknown as Json,
      visibilityLevel: ctx.characterBlockRow.visibility_level,
      visibilityScopeId: ctx.characterBlockRow.visibility_scope_id,
    });
  }

  const sessionId = params.campaignId ? await getOrOpenSessionForCampaign(supabase, params.campaignId) : null;
  const basePatch: RuntimeStatePatch = {
    ...healedByRest(state, ctx.sheet.hitPoints.max, ctx.sheet.hitPoints.max),
    hit_dice: nextHitDice,
    exhaustion: Math.max(0, state.exhaustion - 1),
    // Chaque niveau consomme remis a 0 : `{}` ne remettait rien, la fusion
    // se faisant cle par cle (`clearedSpellSlots`).
    spell_slots_used: clearedSpellSlots(state.spell_slots_used),
    resources: rechargeResources(ctx.resourcesData, state.resources, ["short_rest", "long_rest"]),
  };
  const triggered = await restTriggersPatch(supabase, ctx, mergeRuntimeState(state, basePatch), "long_rest");
  await applyRuntimeStateChange(supabase, {
    entityId: params.entityId,
    campaignId: params.campaignId,
    patch: { ...basePatch, ...triggered.patch },
    note: restNote("Repos long", triggered.notes),
    sessionId,
    actor: "player",
    actorUserId: params.actorUserId,
  });
  await advanceSceneClockForRest(supabase, params.campaignId, LONG_REST_MINUTES, params.actorUserId);

  return { ok: true };
}

export type ApplyLevelUpError =
  | "not_found"
  | "conflict"
  | "invalid_level_change"
  | "invalid_asi"
  | "invalid_hp_choice"
  | "xp_insufficient"
  | "forbidden_field_change"
  | "level_cap_exceeded"
  | "multiclass_prerequisites_unmet";

export interface ApplyLevelUpOutcome {
  character: BlockRow;
  spellcasting?: BlockRow;
}

/**
 * Compare deux `BlockReference | null` par leur CONTENU, jamais par
 * `JSON.stringify` : `ctx.characterData` vient d'une colonne `jsonb`, qui ne
 * garantit pas l'ordre des cles d'un objet apres un aller-retour — deux
 * objets identiques (`{kind:"rule",key:"dwarf"}` vs `{key:"dwarf",kind:"rule"}`)
 * produiraient des chaines differentes et declencheraient un rejet
 * `forbidden_field_change` a tort.
 */
function sameBlockReference(a: BlockReference | null, b: BlockReference | null): boolean {
  if (a === null || b === null) return a === b;
  if (a.kind !== b.kind) return false;
  return a.kind === "rule" && b.kind === "rule" ? a.key === b.key : a.kind === "entity" && b.kind === "entity" ? a.id === b.id : false;
}

/**
 * Montee de niveau accompagnee (V2-G1) : ajoute un niveau a une classe
 * existante ou en demarre une nouvelle (multiclassage), applique les choix
 * qui en decoulent (competences, sorts, amelioration de caracteristique).
 * Chirurgical par construction — ne touche jamais l'inventaire, l'espece,
 * l'historique, le portrait, le genre ni les pronoms, meme si le payload
 * les porte tous : `LevelUpWizard` (cote client) n'expose aucune interface
 * pour les changer, mais le serveur ne fait jamais confiance a une
 * interface seule pour garantir une invariante (`forbidden_field_change`
 * ci-dessous). Ne renomme jamais l'entite — contrairement a
 * `overwriteCharacterFromWizard`, le mauvais outil pour un ajout
 * chirurgical.
 *
 * Validations dans l'ordre : version attendue, champs hors perimetre
 * inchanges, niveaux qui ne peuvent que monter, seuil de PX reellement
 * atteint, puis un recalcul complet de la fiche CANDIDATE (jamais
 * `ctx.sheet`, qui est l'ancienne) pour verifier le plafond de 20 et la
 * legitimite de chaque choix d'ASI (le niveau accorde-t-il vraiment une
 * amelioration de caracteristique pour cette classe, lu dans
 * `assembleResolvedRuleset` — jamais une liste de niveaux codee en dur).
 *
 * Regles de personnage du ruleset (V3.1-115, ADR 0046) : plafond de niveau,
 * plafond de caracteristique et prerequis de multiclassage se lisent dans
 * `assembled.ruleset.characterRules` / `ResolvedClass`, jamais en constante.
 * Un prerequis de multiclassage non rempli refuse la montee, SAUF pour le MJ
 * (`isWorldAdmin`) qui l'a explicitement demande (`overrideMulticlassPrerequisites`) ;
 * une joueuse qui envoie le drapeau est refusee comme si elle ne l'avait pas fait.
 */
export async function applyLevelUp(
  supabase: TypedClient,
  params: {
    entityId: string;
    campaignId: string | null;
    expectedVersion: number;
    character: CharacterBlockData;
    spellcasting: SpellcastingBlockData | undefined;
    /** Un choix moyenne/jet par NOUVEAU niveau gagne, par classe (V2-G1) — jamais une valeur, seulement une intention ; le jet lui-meme se fait ici (regle 6). */
    hpChoices: Record<string, HpGainChoice[]>;
    /** Le MJ passe outre un prerequis de multiclassage non rempli (V3.1-115). Sans effet pour qui n'est pas MJ du monde. */
    overrideMulticlassPrerequisites: boolean;
    actorUserId: string;
    locale: Locale;
  }
): Promise<ApplyLevelUpOutcome | { error: ApplyLevelUpError }> {
  const ctx = await resolveCharacterActionContext(supabase, params.entityId, params.campaignId, params.locale);
  if (!ctx) return { error: "not_found" };
  if (ctx.characterBlockRow.version !== params.expectedVersion) return { error: "conflict" };

  const old = ctx.characterData;
  const next = params.character;
  if (
    !sameBlockReference(old.species, next.species) ||
    !sameBlockReference(old.background, next.background) ||
    old.portrait_asset_id !== next.portrait_asset_id ||
    (old.gender ?? null) !== (next.gender ?? null) ||
    (old.pronouns ?? "") !== (next.pronouns ?? "") ||
    (old.age ?? null) !== (next.age ?? null)
  ) {
    return { error: "forbidden_field_change" };
  }

  const oldLevelByKey = new Map(
    old.classes.filter((c) => c.class.kind === "rule" && c.class.key).map((c) => [(c.class as { kind: "rule"; key: string }).key, c.level])
  );
  for (const c of next.classes) {
    if (c.class.kind !== "rule" || !c.class.key) continue;
    if (c.level < (oldLevelByKey.get(c.class.key) ?? 0)) return { error: "invalid_level_change" };
  }
  const oldTotalLevel = old.classes.reduce((sum, c) => sum + c.level, 0);
  const newTotalLevel = next.classes.reduce((sum, c) => sum + c.level, 0);
  if (newTotalLevel <= oldTotalLevel) return { error: "invalid_level_change" };

  const state = await getEntityRuntimeState(supabase, params.entityId, params.campaignId);
  if (!hasReachedNextLevel(oldTotalLevel, state.xp)) return { error: "xp_insufficient" };

  // Fiche CANDIDATE : reconstruit avec les NOUVEAUX niveaux et choix — jamais
  // ctx.sheet, qui reste celle d'avant la montee.
  const speciesKey = next.species?.kind === "rule" ? next.species.key : undefined;
  const backgroundKey = next.background?.kind === "rule" ? next.background.key : undefined;
  const classSelections = next.classes
    .filter((c) => c.class.kind === "rule" && c.class.key)
    .map((c) => ({ key: (c.class as { kind: "rule"; key: string }).key, level: c.level }));
  const assembled = await assembleResolvedRuleset(
    supabase,
    ctx.rulesetId,
    { species: speciesKey, background: backgroundKey, classes: classSelections, choices: next.choices },
    params.locale
  );

  // Plafond de niveau du ruleset (V3.1-115) : sur le niveau TOTAL.
  const characterRules = assembled.ruleset.characterRules;
  if (characterRules && exceedsLevelCap(newTotalLevel, characterRules.level_cap)) return { error: "level_cap_exceeded" };

  // Multiclassage (V3.1-115, regle 5e) : une classe NOUVELLE exige son
  // prerequis ET celui de chaque classe actuelle, avec les caracteristiques
  // actuelles (`ctx.sheet`, la fiche d'AVANT la montee). Non rempli : refus,
  // sauf pour le MJ qui passe outre explicitement.
  const newClassKeys = [...new Set(next.classes.filter((c) => c.class.kind === "rule" && c.class.key).map((c) => (c.class as { kind: "rule"; key: string }).key))].filter(
    (key) => !oldLevelByKey.has(key)
  );
  if (newClassKeys.length > 0 && oldLevelByKey.size > 0) {
    const currentScores = Object.fromEntries(ABILITIES.map((a) => [a, ctx.sheet.abilities[a].score])) as Record<Ability, number>;
    const entry = checkMulticlassEntry(
      [...newClassKeys, ...oldLevelByKey.keys()].map((key) => ({ key, prerequisites: assembled.ruleset.classes[key]?.multiclassPrerequisites })),
      currentScores
    );
    if (!entry.met) {
      const mayOverride =
        params.overrideMulticlassPrerequisites && (await isWorldAdmin(supabase, { worldId: ctx.worldId, userId: params.actorUserId }));
      if (!mayOverride) return { error: "multiclass_prerequisites_unmet" };
    }
  }

  // Jet de de de vie (V2-G1) : chaque niveau NOUVELLEMENT gagne (jamais un
  // niveau deja possede) exige un choix moyenne/jet explicite, un par
  // niveau — jamais un choix global qui masquerait de quelle classe/de il
  // s'agit. Le client ne propose qu'une INTENTION (`params.hpChoices`) ;
  // le jet lui-meme est execute ici, jamais fait confiance venant du client
  // (CLAUDE.md regle 6). Les classes qui ne gagnent aucun niveau cette
  // fois-ci gardent leur historique EXACT de `old`, jamais celui que `next`
  // pretend porter — meme discipline que `sameBlockReference` plus haut.
  const finalClasses: CharacterBlockData["classes"] = [];
  for (const c of next.classes) {
    if (c.class.kind !== "rule" || !c.class.key) {
      finalClasses.push(c);
      continue;
    }
    const key = c.class.key;
    const oldRolls = old.classes.find((oc) => oc.class.kind === "rule" && oc.class.key === key)?.hp_rolls ?? [];
    const delta = c.level - (oldLevelByKey.get(key) ?? 0);
    if (delta <= 0) {
      finalClasses.push({ ...c, hp_rolls: oldRolls });
      continue;
    }
    const klass = assembled.ruleset.classes[key];
    if (!klass) return { error: "invalid_level_change" };
    const choices = params.hpChoices[key];
    if (!choices || choices.length !== delta) return { error: "invalid_hp_choice" };
    const newRolls = choices.map((choice) => resolveHpGain(choice, klass.hitDie, serverRng));
    finalClasses.push({ ...c, hp_rolls: [...oldRolls, ...newRolls] });
  }

  const choiceFeatures: Record<string, ResolvedFeature> = {};
  const choiceFeatureKeys: string[] = [];
  for (const choice of assembled.remainingChoices) {
    const chosen = (next.choices[choice.id] as string[] | undefined) ?? [];
    const key = `choice:${choice.id}`;
    choiceFeatures[key] = { key, label: choice.label, source: "choice", modifiers: mapChosenSkillModifiers(chosen, choice.id, choice.label) };
    choiceFeatureKeys.push(key);
  }

  const ASI_CHOICE_KEY = /^(.+)\.l(\d+)\.asi$/;
  const asiChoices: AsiChoice[] = [];
  for (const [choiceKey, rawValue] of Object.entries(next.choices)) {
    const match = ASI_CHOICE_KEY.exec(choiceKey);
    if (!match) continue;
    const [, classKey, levelText] = match;
    const asi = parseAsiChoice(rawValue);
    if (!asi || !isValidAsiChoice(asi)) return { error: "invalid_asi" };
    if (!(assembled.asiGrantedLevels[classKey] ?? []).includes(Number(levelText))) return { error: "invalid_asi" };
    asiChoices.push(asi);

    const key = `choice:${choiceKey}`;
    const label = `Amélioration de caractéristique (${assembled.ruleset.classes[classKey]?.label ?? classKey} niv. ${levelText})`;
    choiceFeatures[key] = { key, label, source: `asi:${choiceKey}`, modifiers: asiModifiers(asi, `asi:${choiceKey}`, label) };
    choiceFeatureKeys.push(key);
  }

  const build: CharacterBuild = {
    species: speciesKey ?? "",
    classes: finalClasses
      .filter((c) => c.class.kind === "rule" && c.class.key)
      .map((c) => ({
        key: (c.class as { kind: "rule"; key: string }).key,
        level: c.level,
        subclass: c.subclass?.kind === "rule" ? c.subclass.key : undefined,
        hpRolls: c.hp_rolls,
      })),
    abilities: { assigned: next.abilities.base },
    featureKeys: [...Object.keys(assembled.ruleset.features), ...choiceFeatureKeys],
  };
  // Sans `characterRules` : la fiche candidate ne PLAFONNE pas les scores, qu'on
  // compare ensuite nous-memes au plafond du ruleset (un choix qui le depasserait
  // doit etre refuse, pas silencieusement ramene au plafond).
  const candidateSheet = characterSheet(
    build,
    { classes: assembled.ruleset.classes, features: { ...assembled.ruleset.features, ...choiceFeatures } },
    [],
    []
  );
  if (characterRules) {
    const candidateScores = Object.fromEntries(ABILITIES.map((a) => [a, candidateSheet.abilities[a].score])) as Record<Ability, number>;
    if (!withinAbilityScoreCap(candidateScores, characterRules.ability_score_cap)) return { error: "invalid_asi" };
    for (const asi of asiChoices) {
      const scoresBefore = Object.fromEntries(ABILITIES.map((a) => [a, candidateScores[a] - (asi.increases[a] ?? 0)])) as Record<Ability, number>;
      if (asiExceedsCap(asi, scoresBefore, characterRules.ability_score_cap)) return { error: "invalid_asi" };
    }
  }

  const updatedCharacter = await updateBlockWithVersionCheck(supabase, {
    id: ctx.characterBlockRow.id,
    expectedVersion: ctx.characterBlockRow.version,
    display: ctx.characterBlockRow.display,
    data: { ...next, classes: finalClasses } as unknown as Json,
    visibilityLevel: ctx.characterBlockRow.visibility_level,
    visibilityScopeId: ctx.characterBlockRow.visibility_scope_id,
  });
  if (!updatedCharacter) return { error: "conflict" };

  let updatedSpellcasting: BlockRow | undefined;
  if (params.spellcasting) {
    const blocks = await listBlocksForEntity(supabase, params.entityId);
    const spellcastingRow = blocks.find((b) => b.block_type === "spellcasting");
    if (spellcastingRow) {
      updatedSpellcasting =
        (await updateBlockWithVersionCheck(supabase, {
          id: spellcastingRow.id,
          expectedVersion: spellcastingRow.version,
          display: spellcastingRow.display,
          data: params.spellcasting as unknown as Json,
          visibilityLevel: spellcastingRow.visibility_level,
          visibilityScopeId: spellcastingRow.visibility_scope_id,
        })) ?? undefined;
    } else if (params.spellcasting.known.length > 0) {
      // Une classe non incantatrice qui multiclasse vers une classe qui
      // l'est n'a encore aucun bloc spellcasting — cree seulement s'il y a
      // deja un sort connu, jamais un bloc vide (meme regle qu'a la
      // creation, `createCharacterFromWizard`).
      updatedSpellcasting = await insertBlock(supabase, {
        entityId: params.entityId,
        blockType: "spellcasting",
        display: defaultBlockDisplay("spellcasting", "Incantation"),
        data: params.spellcasting as unknown as Json,
        displayOrder: 3000,
        visibilityLevel: "public",
        visibilityScopeId: null,
        createdBy: params.actorUserId,
      });
    }
  }

  return { character: updatedCharacter, spellcasting: updatedSpellcasting };
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

/**
 * PV courants +/- (bouton manuel de l'en-tete) — jamais un jet, une simple
 * modification d'etat, mais qui suit les memes regles que la resolution des
 * degats du tour (V3.1-24, ADR 0036 §8) : un delta negatif entame d'abord les
 * PV temporaires, puis les courants ; a 0 PV, Inconscient, mort directe ou
 * echec aux jets contre la mort ; un delta positif est un soin (jets remis a
 * zero, Inconscient retire). Les PV maximum ne sont lus (fiche derivee) que si
 * le coup atteint zero : seule la mort directe en a besoin.
 */
export async function changeHp(
  supabase: TypedClient,
  params: { entityId: string; campaignId: string | null; delta: number; actorUserId: string; locale: Locale }
): Promise<void> {
  const state = await getEntityRuntimeState(supabase, params.entityId, params.campaignId);
  const sessionId = params.campaignId ? await getOrOpenSessionForCampaign(supabase, params.campaignId) : null;

  // Sans fiche derivee (entite sans personnage), pas de maximum : ni mort directe, ni plafond de soin, comme avant.
  let hpMax = Number.MAX_SAFE_INTEGER;
  if (params.delta < 0 && -params.delta >= state.hp.temp + state.hp.current) {
    const ctx = await resolveCharacterActionContext(supabase, params.entityId, params.campaignId, params.locale);
    if (ctx) hpMax = ctx.sheet.hitPoints.max;
  }

  const before: DeathState = {
    hp: { current: state.hp.current, max: hpMax, temp: state.hp.temp },
    conditions: state.conditions,
    deathSaves: state.death_saves,
  };
  const after = params.delta < 0 ? applyDamageWithDeath(before, -params.delta) : applyHealing(before, params.delta);

  await applyRuntimeStateChange(supabase, {
    entityId: params.entityId,
    campaignId: params.campaignId,
    patch: {
      hp: { current: after.hp.current, temp: after.hp.temp },
      conditions: after.conditions,
      death_saves: after.deathSaves,
    },
    note: `PV ${params.delta >= 0 ? "+" : ""}${params.delta}`,
    sessionId,
    actor: "player",
    actorUserId: params.actorUserId,
  });
}

/**
 * PV temporaires donnes (V3.1-24, ticket point 5) : ils ne se cumulent pas.
 * `choice` : garder les anciens, prendre les nouveaux, ou le plus grand des
 * deux (par defaut, ce que propose l'interface). Un montant a zero ne fait
 * rien ; retirer des PV temporaires se fait par `changeHp` (ils partent
 * d'abord).
 */
export async function changeTempHp(
  supabase: TypedClient,
  params: { entityId: string; campaignId: string | null; amount: number; choice?: TempHpChoice; actorUserId: string }
): Promise<void> {
  const state = await getEntityRuntimeState(supabase, params.entityId, params.campaignId);
  const temp = grantTempHp(state.hp.temp, params.amount, params.choice ?? "largest");
  if (temp === state.hp.temp) return;
  const sessionId = params.campaignId ? await getOrOpenSessionForCampaign(supabase, params.campaignId) : null;
  await applyRuntimeStateChange(supabase, {
    entityId: params.entityId,
    campaignId: params.campaignId,
    patch: { hp: { temp } },
    note: `PV temporaires ${state.hp.temp} → ${temp}`,
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

/**
 * V2.1-26 — l'inspiration heroique. Meme geste que l'epuisement, a trois
 * lignes d'ici : un delta, borne cote SERVEUR, journalise comme toute
 * mutation de jeu. Le client propose un delta, il ne pose jamais la valeur.
 * `max` : plafond de la table (`table_settings.inspiration_max`, V3.1-108).
 */
export async function changeInspiration(
  supabase: TypedClient,
  params: { entityId: string; campaignId: string | null; delta: number; actorUserId: string; max?: number }
): Promise<void> {
  const state = await getEntityRuntimeState(supabase, params.entityId, params.campaignId);
  const sessionId = params.campaignId ? await getOrOpenSessionForCampaign(supabase, params.campaignId) : null;
  await applyRuntimeStateChange(supabase, {
    entityId: params.entityId,
    campaignId: params.campaignId,
    patch: { inspiration: Math.max(0, Math.min(params.max ?? 5, state.inspiration + params.delta)) },
    note: `Inspiration ${params.delta >= 0 ? "+" : ""}${params.delta}`,
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
