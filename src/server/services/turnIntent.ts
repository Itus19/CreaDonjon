import type { DiceRollKind } from "@/src/core/dice/rollAttribution";
import { presentsIci } from "@/src/core/rules/scenePresence";
import "server-only";
import { applyTrade, readInventorySnapshot } from "@/src/server/services/inventoryActions";
import { readCurrencySystemForEntity } from "@/src/server/services/currencySystem";
import { weaponRollProperties } from "@/src/core/rules/srdMapping";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import { attackVerdict } from "@/src/core/rules/targeting";
import type { Locale } from "@/src/i18n/request";
import {
  ABILITIES,
  ABILITY_LABELS,
  SKILLS,
  SKILL_ABILITIES,
  lightExtraAddsAbility,
  rollBonus,
  type Ability,
  type BonusDie,
  type Skill,
  type Source,
} from "@/src/core/rules/sheet";
import { SKILL_LABELS_FR, INTENT_VERBS_FR, TRADE_VERBS_FR, TRADE_LODGING_TERMS_FR, TRADE_TAB_TERMS_FR, formatCpFr } from "@/src/i18n/fr";
import { addToTab, clearTabAt, tabAt, tabTotalCp } from "@/src/core/rules/tab";
import { putSceneState } from "@/src/server/repos/sceneStates";
import { type IntentAction, type IntentTarget } from "@/src/core/rules/intent";
import { autoSuccess, dcForTier, type CheckTier } from "@/src/core/rules/checkDifficulty";
import type { ResolvedEffect, FiredEvent } from "@/src/core/rules/triggers";
import { flooredRng, lightExtraDamageMod, resolveCheckRoll, resolveDamageRoll, weaponAttackAbility, type AdvantageState } from "@/src/core/rules/action";
import { rollDice } from "@/src/core/dice/roll";
import { eventsForCheck, eventsForSave } from "@/src/core/rules/gameEvents";
import { parseFormula } from "@/src/core/formula/parser";
import type { TraceStep } from "@/src/core/formula/evaluate";
import type { BlockReference } from "@/src/core/schemas/blocks/reference";
import type { InventoryItem } from "@/src/core/schemas/blocks/inventory";
import type { PendingRequest, PendingRequestKind } from "@/src/core/schemas/runtimeState";
import {
  resolveCharacterActionContext,
  rollWeaponAttack,
  rollWeaponDamage,
  type ActionErrorReason,
  type CharacterActionContext,
} from "@/src/server/services/characterActions";
import {
  fireForRoll,
  rollAbilityCheck,
  rollSavingThrow,
  rollSkillCheck,
  type CheckRollErrorReason,
  type RollOutcome,
} from "@/src/server/services/checkRolls";
import { resolveBlockReferences } from "@/src/server/services/referenceChips";
import { getSceneState } from "@/src/server/repos/sceneStates";
import { listBlocksByTypeForEntities } from "@/src/server/repos/blocks";
import type { SceneState } from "@/src/core/rules/scene";
import { zPriceListBlockData, type PriceListBlockData } from "@/src/core/schemas/blocks/priceList";
import { itemCostPrice, priceCp, resaleCp } from "@/src/core/rules/priceList";
import { totalValueCp } from "@/src/core/rules/currency";
import { tradeForGift, tradeForOffer, tradeForSale, tradeForTab, tradeOffersFromPriceList, type TradeCatalog, type TradeDirection, type TradeItemEntry } from "@/src/core/rules/tradeIntent";
import type { Trade, TradeMissing } from "@/src/core/rules/trade";
import type { InventoryBlockData } from "@/src/core/schemas/blocks/inventory";
import { listCombatsForCampaign, listCombatParticipants } from "@/src/server/repos/combats";
import { listEntitiesByIds } from "@/src/server/repos/entities";
import { insertSessionEvent, nextEventSeq } from "@/src/server/repos/sessions";
import { insertDiceRoll } from "@/src/server/repos/diceRolls";
import { getOrOpenSessionForCampaign } from "@/src/server/services/sessions";
import { serverRng } from "@/src/server/services/rng";
import { soloCritRange, soloRollWindow } from "@/src/server/services/soloRollWindow";
import { applyRuntimeStateChange, getEntityRuntimeState } from "@/src/server/services/runtimeState";
import { getRuntimeState } from "@/src/server/repos/runtimeState";
import type { TargetId, IntentTargetDetail, IntentBarData, TurnRecord } from "@/lib/solo/types";

type TypedClient = SupabaseClient<Database>;

/**
 * V3-B1 — La barre d'intention, cote serveur.
 *
 * Le ticket repond au trou le plus grave de l'ADR 0009 : « rien dans
 * l'ecran ne force son usage : la garantie "le modele ne calcule rien" ne
 * tient que si l'humain pense a toujours fournir le fait ». Ce module est
 * la reponse, et elle est structurelle plutot que disciplinaire — la
 * mecanique n'est pas une case a cocher qu'on oublie, c'est le chemin.
 *
 * Deux temps, et l'ordre n'est pas negociable :
 *
 *   LIRE la phrase — `interpretIntent`, noyau pur, execute par l'ecran.
 *     Aucun de, aucune ecriture, aucun aller-retour.
 *   EXECUTER le choix retenu — `executeIntent`, ici. Le seul a lancer,
 *     et il ne recoit jamais une phrase a deviner.
 *
 * Ce que ce module ne fait pas, volontairement :
 *
 * - **Il n'appelle aucun modele.** Ni pour lire l'intention (la
 *   correspondance est deterministe, le repli est l'action libre), ni pour
 *   raconter. La narration est V3-B2 ; elle partira des `facts` journalises
 *   ici, donc apres la resolution, jamais avant.
 * - **Il n'applique rien a la cible.** Les PV du gobelin ne bougent pas :
 *   appliquer est V3-B2. B1 etablit des faits et les consigne.
 */

export type { TargetId, IntentTargetDetail, IntentBarData, TurnRecord };

/**
 * V3-B2 : le meme enregistrement, plus ce que la resolution a REVEILLE.
 * Les effets ne traversent pas jusqu'au client — seule la boucle de tour
 * les applique, et c'est elle qui dit ensuite ce qui a change.
 */
export interface ResolvedTurnRecord extends TurnRecord {
  effects: ResolvedEffect[];
}

function itemRef(item: InventoryItem): BlockReference | null {
  return (item as { ref?: BlockReference }).ref ?? null;
}

/** Meme motif que `itemRef` — recopie plutot qu'importee (`characterActions.ts` ne l'exporte pas), meme profil que `itemRef`/`itemLabel` deja dupliques ailleurs (inventoryItem.ts, cote client). */
function itemLabel(item: InventoryItem): string {
  const label = (item as { label?: string }).label;
  if (label) return label;
  const ref = itemRef(item);
  if (ref) return ref.kind === "rule" ? ref.key : ref.id;
  return "";
}

/**
 * Les mots qui designent une cible : son nom, et son nom sans le numero
 * de rang.
 *
 * Constate en jouant (22 septembre) : le moteur ne reconnaissait pas « le
 * gobelin » pour une ligne de combat nommee « Gobelin 2 », alors que c'est
 * exactement ainsi qu'on parle a une table. La correspondance reste
 * EXACTE — on ajoute un terme, on n'assouplit pas la regle : « Gobelin 2 »
 * l'emporte toujours sur « Gobelin » quand les deux sont ecrits, puisque
 * `detectEntityReferences` prefere la plus longue.
 *
 * Quand deux gobelins repondent au meme « gobelin », c'est le premier de
 * l'ordre d'initiative qui est propose, et l'ecran laisse corriger d'un
 * clic — jamais un tirage au sort.
 */
function targetTerms(label: string): string[] {
  const withoutRank = label.replace(/\s+\d+$/, "").trim();
  return withoutRank !== "" && withoutRank !== label ? [label, withoutRank] : [label];
}

/**
 * Les cibles possibles d'un tour : les participants du combat en cours
 * d'abord, les presents de la scene ensuite.
 *
 * Pourquoi les deux. La scene (V3-A4) est la source de verite de « qui est
 * la », mais **rien ne la fait encore avancer** — c'est le lot B, et B1 en
 * est le premier ticket. Le combat, lui, porte des adversaires reels
 * aujourd'hui, avec leur CA : sans eux, une barre d'intention n'aurait
 * personne a viser et ne se jouerait pas. On lit donc les deux, le combat
 * en premier parce qu'il est le seul a donner une CA.
 */
async function loadTargets(
  supabase: TypedClient,
  params: { campaignId: string | null; actorEntityId: string; scene: SceneState | null }
): Promise<IntentTargetDetail[]> {
  if (!params.campaignId) return [];

  const details: IntentTargetDetail[] = [];
  const seenEntityIds = new Set<string>([params.actorEntityId]);

  const combats = await listCombatsForCampaign(supabase, params.campaignId);
  const running = combats.find((c) => c.status === "running");
  if (running) {
    for (const participant of await listCombatParticipants(supabase, running.id)) {
      if (participant.entity_id && seenEntityIds.has(participant.entity_id)) continue;
      if (participant.entity_id) seenEntityIds.add(participant.entity_id);
      details.push({
        id: `participant:${participant.id}`,
        label: participant.label,
        ac: participant.ac,
        hpCurrent: participant.hp_current,
        source: "combat",
      });
    }
  }

  const scenePresent = (params.scene ? presentsIci(params.scene) : []).map((p) => p.entityId).filter((id) => !seenEntityIds.has(id));
  if (scenePresent.length > 0) {
    for (const entity of await listEntitiesByIds(supabase, scenePresent)) {
      details.push({ id: `entity:${entity.id}`, label: entity.name, ac: null, hpCurrent: null, source: "scene" });
    }
  }

  return details;
}

/**
 * V3.2-10 — la carte du lieu de la scène (bloc `price_list`, V3.2-9), lue sous
 * la RLS de la personne qui joue : une carte qu'elle ne peut pas voir n'existe
 * pas pour elle. Une lecture ciblée par affichage de l'écran (docs/QUOTAS.md).
 * Une carte illisible est signalée et traitée comme absente, jamais devinée.
 */
async function readPriceList(supabase: TypedClient, locationId: string): Promise<PriceListBlockData | null> {
  const row = (await listBlocksByTypeForEntities(supabase, [locationId], "price_list"))[0];
  if (!row) return null;
  const parsed = zPriceListBlockData.safeParse(row.data);
  if (!parsed.success) {
    console.error("Carte du lieu illisible", locationId, parsed.error.issues);
    return null;
  }
  return parsed.data;
}

/**
 * V3.2-10 — ce qui s'achète ici (la carte), ce qui se vend ou se donne (le
 * sac), et la bourse. Le prix de revente vient du bloc `cost` de la fiche de
 * règle, déjà lu avec l'équipement ; un objet libre ou un artéfact n'en a pas.
 * La bourse est comptée au système par défaut, pour l'affichage seulement :
 * le règlement relit le vrai système monétaire (`executeTrade`).
 */
function buildTradeCatalog(
  ctx: CharacterActionContext,
  nameOf: (item: InventoryItem) => string,
  priceList: PriceListBlockData | null,
  scene: SceneState | null
): TradeCatalog {
  const offers = tradeOffersFromPriceList(priceList?.offers ?? [], TRADE_LODGING_TERMS_FR);
  const items: TradeItemEntry[] = (ctx.inventoryData?.items ?? []).map((item) => {
    const ref = itemRef(item);
    const cost = ref?.kind === "rule" ? ctx.costByKey[ref.key] : null;
    const price = cost ? itemCostPrice({ value: cost.quantity, unit: cost.unit }) : null;
    const name = nameOf(item);
    return { id: item.id, label: name, terms: name ? [name] : [], resaleCp: price ? resaleCp(priceCp(price)) : null };
  });
  return {
    verbs: TRADE_VERBS_FR,
    offers,
    items,
    purseCp: ctx.inventoryData ? totalValueCp(ctx.inventoryData.currency) : 0,
    // Hors scène, il n'y a pas de lieu où tirer une carte : on ne le propose pas.
    hasPriceList: priceList !== null || scene === null,
    // V3.2-11 : l'ardoise de CE lieu, relue par le serveur au règlement.
    tabCp: scene ? tabTotalCp(tabAt(scene, scene.locationId)) : 0,
    tabTerms: TRADE_TAB_TERMS_FR,
  };
}

/**
 * Le catalogue de CE personnage : ce qu'il peut faire, et qui il peut
 * viser. C'est le seul endroit ou la langue entre — les identifiants
 * restent techniques, les `terms` sont ce qu'un joueur ecrit.
 *
 * Les competences et caracteristiques y sont TOUTES, pas seulement celles
 * ou le personnage est maitrise : n'importe qui peut tenter n'importe quel
 * test, et un catalogue qui filtrerait rendrait « je fouille » incomprehensible
 * a un personnage sans Investigation — exactement l'inverse de ce qu'on veut.
 */
export async function buildIntentBarData(
  supabase: TypedClient,
  params: { entityId: string; campaignId: string | null; world: { id: string; slug: string }; locale: Locale }
): Promise<IntentBarData | null> {
  const ctx = await resolveCharacterActionContext(supabase, params.entityId, params.campaignId, params.locale);
  if (!ctx) return null;

  // Armes equipees dont la fiche de regle resout vraiment — memes criteres
  // que l'onglet Actions de la fiche jouable (`useCharacterSheetContext`),
  // jamais une seconde definition de « ce qu'on peut degainer ».
  const items = ctx.inventoryData?.items ?? [];
  const equippedWeapons = items.filter((item) => {
    if (!item.equipped) return false;
    const ref = itemRef(item);
    return ref?.kind === "rule" && Boolean(ctx.weaponByKey[ref.key]);
  });

  // Le nom FRANCAIS d'un objet, pas sa cle SRD : le joueur ecrit « épée
  // longue », jamais « longsword ». V3.2-10 : tout le sac, pas seulement les
  // armes (on vend aussi une corde) — toujours une seule résolution groupée.
  // La scène et la carte du lieu partent dans la même vague (docs/CABLAGE.md, C3).
  const refItems = items.filter((item) => itemRef(item) !== null);
  const [chips, scene] = await Promise.all([
    resolveBlockReferences(supabase, params.world, ctx.rulesetId, params.locale, refItems.map((item) => itemRef(item)!)),
    params.campaignId ? getSceneState(supabase, params.campaignId) : Promise.resolve(null),
  ]);
  const nameByItemId = new Map<string, string>(refItems.map((item, index) => [item.id, chips[index]?.found ? chips[index].name : itemLabel(item)]));
  const nameOf = (item: InventoryItem) => nameByItemId.get(item.id) ?? itemLabel(item);

  const actions: IntentAction[] = [];
  equippedWeapons.forEach((item) => {
    const name = nameByItemId.get(item.id) ?? "";
    actions.push({
      id: item.id,
      kind: "weapon_attack",
      label: name || "Arme",
      terms: name ? [name] : [],
    });
  });
  // Propriété Légère : avec deux armes Légères en main, l'attaque en plus (action Bonus) avec chacune.
  const legeres = equippedWeapons.filter((item) => {
    const ref = itemRef(item);
    return ref?.kind === "rule" && ctx.weaponByKey[ref.key]?.properties.includes("light") === true;
  });
  if (legeres.length >= 2) {
    for (const item of legeres) {
      actions.push({ id: item.id, kind: "weapon_attack", label: `${nameByItemId.get(item.id) || "Arme"} — attaque en plus (action Bonus)`, terms: [], lightExtra: true });
    }
  }
  for (const skill of SKILLS) {
    // V3.2-21 : le nom seul ne lance un jet que s'il est toute la phrase ;
    // « jet d'Histoire » le lance où qu'il soit (`explicitTerms`).
    actions.push({ id: skill, kind: "skill_check", label: SKILL_LABELS_FR[skill], terms: [SKILL_LABELS_FR[skill]], explicitTerms: explicitCheckTerms(SKILL_LABELS_FR[skill]) });
  }
  for (const ability of ABILITIES) {
    // « test de Force », jamais « force » tout court : le mot est trop
    // courant en francais pour servir de declencheur de jet.
    actions.push({
      id: ability,
      kind: "ability_check",
      label: `Test de ${ABILITY_LABELS[ability]}`,
      terms: [`test de ${ABILITY_LABELS[ability]}`, `jet de ${ABILITY_LABELS[ability]}`],
      // Ces termes sont déjà des demandes en toutes lettres.
      explicitTerms: [`test de ${ABILITY_LABELS[ability]}`, `jet de ${ABILITY_LABELS[ability]}`],
    });
    actions.push({
      id: ability,
      kind: "saving_throw",
      label: `Sauvegarde de ${ABILITY_LABELS[ability]}`,
      terms: [`sauvegarde de ${ABILITY_LABELS[ability]}`, `jet de sauvegarde de ${ABILITY_LABELS[ability]}`],
      explicitTerms: [`sauvegarde de ${ABILITY_LABELS[ability]}`, `jet de sauvegarde de ${ABILITY_LABELS[ability]}`],
    });
  }

  const [targetDetails, priceList] = await Promise.all([
    loadTargets(supabase, { campaignId: params.campaignId, actorEntityId: params.entityId, scene }),
    scene ? readPriceList(supabase, scene.locationId) : Promise.resolve(null),
  ]);
  const targets: IntentTarget[] = targetDetails.map((t) => ({ id: t.id, label: t.label, terms: targetTerms(t.label) }));

  return {
    actor: { entityId: ctx.entityId, name: ctx.entityName },
    catalog: { actions, targets, verbs: INTENT_VERBS_FR },
    trade: buildTradeCatalog(ctx, nameOf, priceList, scene),
    targetDetails,
    ruleKeys: ctx.sheet.features.map((f) => f.key).filter((k) => !k.startsWith("choice:")),
  };
}

/**
 * V3.2-23 — ce que le classement d'un tour reçoit en plus de la phrase : le
 * nom du personnage et les présents, tels que le joueur les voit (mêmes
 * cibles que la barre). Trois lectures légères, sans la fiche entière.
 */
export async function readClassifyContext(
  supabase: TypedClient,
  params: { entityId: string; campaignId: string }
): Promise<{ actorName: string; presents: string[] }> {
  const [scene, entities] = await Promise.all([getSceneState(supabase, params.campaignId), listEntitiesByIds(supabase, [params.entityId])]);
  const targets = await loadTargets(supabase, { campaignId: params.campaignId, actorEntityId: params.entityId, scene });
  return { actorName: entities[0]?.name ?? "le personnage", presents: targets.map((t) => t.label) };
}

/**
 * V3.2-21 — « jet de Persuasion », « test d'Histoire » : les formes qui
 * demandent un test de compétence en toutes lettres. L'élision suit la
 * première lettre (voyelle ou h) ; l'apostrophe courbe d'un téléphone vaut
 * l'apostrophe droite.
 */
function explicitCheckTerms(label: string): string[] {
  const elision = /^[aeiouyhâàéèêëîïôöûüœ]/i.test(label);
  const liaisons = elision ? ["d'", "d’"] : ["de "];
  return ["jet", "test"].flatMap((mot) => liaisons.map((de) => `${mot} ${de}${label}`));
}

/**
 * V3.2-24 (ADR 0113) — pourquoi une action se joue sans dé : le modèle l'a
 * jugée évidente pour ce personnage, le pire jet atteignait le DD fixé par
 * le moteur, ou le joueur a choisi « Sans jet » sur la pastille. Le fait
 * correspondant part au narrateur, qui raconte en conséquence.
 */
export type SansJet = { raison: "evidente" } | { raison: "automatique"; what: string; dc: number } | { raison: "joueur" };

/**
 * V3.2-24 : `tier`, le palier rendu par le classement du modèle — posé par la
 * route, jamais reçu du navigateur. Le DD en est tiré ici, par le moteur
 * (`dcForTier`), et l'emporte sur `dc`.
 */
export type IntentChoice =
  | { kind: "weapon_attack"; actionId: string; targetId: TargetId | null; advantage: AdvantageState; /** Combat à deux armes : l'attaque en plus d'une arme Légère. */ extra?: "light" }
  | { kind: "skill_check"; actionId: Skill; targetId: TargetId | null; advantage: AdvantageState; dc: number | null; tier?: CheckTier }
  | { kind: "ability_check"; actionId: Ability; targetId: TargetId | null; advantage: AdvantageState; dc: number | null; tier?: CheckTier }
  | { kind: "saving_throw"; actionId: Ability; targetId: TargetId | null; advantage: AdvantageState; dc: number | null; tier?: CheckTier }
  /** V3.2-10 : un achat (offre de la carte), une vente ou un don (objet du sac). Le prix n'en fait pas partie : le serveur le relit. */
  | {
      kind: "trade";
      direction: TradeDirection;
      entryId: string;
      targetId: TargetId | null;
      /** V3.2-11 : un achat consommé sur place, mis sur l'ardoise du lieu plutôt que payé. */
      onTab?: boolean;
    }
  | { kind: "free"; sansJet?: SansJet };

/**
 * V3.2-10 — les refus propres à un échange : l'offre a quitté la carte, l'objet
 * n'a pas de prix de revente, l'inventaire a changé entre-temps (`conflict`),
 * ou le système monétaire ne connaît pas la pièce du prix (`trade_refused`).
 * Un manque d'argent n'en est PAS un : c'est un fait que le PNJ joue.
 */
/** Un choix qui se résout par un jet (posé, puis encaissé en campagne) : ni l'action libre, ni l'échange. */
export type RollChoice = Exclude<IntentChoice, { kind: "free" } | { kind: "trade" }>;

export type TradeErrorReason = "offer_not_found" | "no_resale_price" | "conflict" | "trade_refused" | "no_tab_here" | "tab_full" | "tab_services_only";

/** Les raisons des deux resolveurs reutilises, sans en inventer une : `characterActions` pour les armes, `checkRolls` pour les tests. */
export type IntentErrorReason = ActionErrorReason | CheckRollErrorReason | TradeErrorReason;


function advantageLabel(advantage: AdvantageState): string {
  if (advantage === "advantage") return " (avantage)";
  if (advantage === "disadvantage") return " (désavantage)";
  return "";
}

/**
 * Le detail d'un jet, en francais lisible : « d20 : 14, Intelligence +1 ».
 *
 * Jamais `expression` — verifie en direct le 22 septembre, il rend
 * `1d20 + {mod}`, gabarit a trou que `formatFormulaNode` compose pour la
 * persistance. Correct dans `dice_rolls`, illisible pour un joueur, et
 * franchement dangereux dans un `fact` : c'est ce texte que le modele
 * recevra en V3-B2, et un modele a qui l'on tend `{mod}` finira par
 * l'ecrire dans sa prose ou, pire, par en deviner la valeur.
 *
 * Le de vient de la trace, les modificateurs des `chips` — les memes que le
 * volet de des affiche, jamais recomposes. Le premier pas de trace EST le
 * d20 : `resolveCheckRoll` compose toujours `d20 + {mod}`, dans cet ordre,
 * et `action.ts` s'appuie deja sur cette meme garantie pour lire le
 * naturel obtenu.
 */
function rollDetail(trace: RollOutcome["trace"], chips: RollOutcome["chips"]): string {
  const natural = trace[0];
  const parts = natural ? [`dé : ${natural.value}`] : [];
  for (const chip of chips) {
    if (chip.value === 0) continue;
    parts.push(`${chip.label} ${chip.value >= 0 ? "+" : "−"}${Math.abs(chip.value)}`);
  }
  return parts.length === 0 ? "" : ` (${parts.join(", ")})`;
}

function factsFromCheck(who: string, roll: RollOutcome, target: IntentTargetDetail | null): string[] {
  const against = target ? ` sur ${target.label}` : "";
  const verdict = roll.verdict === null ? "" : roll.verdict === "success" ? " — réussite" : " — échec";
  const dc = roll.dc === null ? "" : ` contre DD ${roll.dc}`;
  return [`${who} — ${roll.what}${against} : ${roll.total}${rollDetail(roll.trace, roll.chips)}${dc}${verdict}.`];
}

/**
 * Journalise le tour dans `session_events` — **avant toute narration**,
 * c'est le critere du ticket. L'ordre porte une promesse : ce qui est ecrit
 * la est acquis, et le restera meme si le modele n'est jamais appele, ou
 * echoue. Journal en ajout seul (SCHEMA.md §12) : on n'y revient pas.
 */
async function journalTurn(
  supabase: TypedClient,
  params: {
    campaignId: string | null;
    callerId: string;
    /** V3-F2 : le personnage du tour, dont l'état est relevé pour pouvoir annuler le tour. */
    entityId: string;
    kind: "roll" | "player_action";
    payload: Record<string, unknown>;
    /** V3.2-10 : l'inventaire déjà relevé AVANT un échange appliqué juste avant le journal ; absent, il est lu ici. */
    inventoryBefore?: InventoryBlockData | null;
    /** V3.2-11 : la scène déjà relevée AVANT qu'un échange y écrive l'ardoise ; absente, elle est lue ici. */
    sceneBefore?: SceneState | null;
  }
): Promise<string | null> {
  if (!params.campaignId) return null;
  const sessionId = await getOrOpenSessionForCampaign(supabase, params.campaignId);
  // V3-F2 (PDD §29) : l'état du personnage et la scène AVANT ce que le tour va appliquer (les effets des jets
  // partent ensuite, dans la boucle du tour) ; « annuler ce tour » les restaure. Deux lectures de plus par tour.
  // L'état tel qu'il est EN BASE : `null` quand le personnage n'a pas encore de ligne (sa fiche montre alors ses PV pleins).
  // V3.2-8 : l'inventaire aussi (un échange le modifie) — une troisième lecture, ciblée sur le bloc `inventory`.
  const [ligneEtat, scene, inventory] = await Promise.all([
    getRuntimeState(supabase, params.entityId, params.campaignId),
    params.sceneBefore !== undefined ? Promise.resolve(params.sceneBefore) : getSceneState(supabase, params.campaignId),
    params.inventoryBefore !== undefined ? Promise.resolve(params.inventoryBefore) : readInventorySnapshot(supabase, params.entityId),
  ]);
  const runtime = ligneEtat?.state ?? null;
  const seq = await nextEventSeq(supabase, sessionId);
  const event = await insertSessionEvent(supabase, {
    sessionId,
    seq,
    kind: params.kind,
    actor: "player",
    actorUserId: params.callerId,
    payload: { __v: 1, ...params.payload, undo_before: { entity_id: params.entityId, runtime, scene, inventory } } as unknown as Json,
  });
  return event.id;
}

/** « Une nuit à l'auberge » entre guillemets, un objet du sac tel quel : la phrase se lit comme à la table. */
function quoted(label: string): string {
  return `« ${label} »`;
}

/**
 * V3.2-10 (ADR 0110) — règle un achat, une vente ou un don choisi dans la
 * barre d'intention. Le PRIX est relu ici, dans la carte du lieu et le bloc
 * `cost` (le même catalogue que l'écran a affiché, reconstruit côté serveur) :
 * le client n'envoie que l'identifiant de l'offre ou de l'objet.
 *
 * L'ordre tient la promesse d'annulation : l'inventaire et la scène sont
 * relevés, l'échange appliqué (une révision du bloc, `applyTrade` ; l'ardoise
 * dans la scène), puis le tour est journalisé avec les relevés d'AVANT —
 * « annuler ce tour » rend pièces, objets et ardoise. Si l'écriture échoue,
 * rien n'est journalisé.
 *
 * **Un manque ne bloque pas.** L'échange court n'écrit rien, mais le tour
 * part avec un fait (« Edran tend 3 pa ; il manque 2 pa… ») : la narration le
 * reçoit comme tout autre fait, et c'est le PNJ qui réagit.
 *
 * V3.2-11 : un achat consommé sur place peut aller sur l'ardoise du lieu
 * (rien n'est payé, une ligne est due) ; régler l'ardoise paie tout ce qui
 * est dû ici, au total relu dans la scène.
 */
async function executeTrade(
  supabase: TypedClient,
  params: {
    entityId: string;
    campaignId: string | null;
    callerId: string;
    choice: Extract<IntentChoice, { kind: "trade" }>;
    data: IntentBarData;
    target: IntentTargetDetail | null;
    intent: Record<string, unknown>;
  }
): Promise<ResolvedTurnRecord | { error: IntentErrorReason }> {
  const { choice, data } = params;
  const who = data.actor.name;
  const to = params.target ? ` à ${params.target.label}` : "";
  const creditor = params.target?.label ?? null;

  const [system, before, sceneBefore] = await Promise.all([
    readCurrencySystemForEntity(supabase, { entityId: params.entityId, campaignId: params.campaignId }),
    readInventorySnapshot(supabase, params.entityId),
    params.campaignId ? getSceneState(supabase, params.campaignId) : Promise.resolve(null),
  ]);

  let trade: Trade | null = null;
  let label: string;
  let priceCp: number | null = null;
  /** La scène à écrire si l'échange tient : l'ardoise allongée (crédit) ou soldée (règlement). */
  let sceneAfter: SceneState | null = null;
  if (choice.direction === "settle") {
    const dueCp = sceneBefore ? tabTotalCp(tabAt(sceneBefore, sceneBefore.locationId)) : 0;
    if (!sceneBefore || dueCp === 0) return { error: "no_tab_here" };
    trade = tradeForTab(dueCp);
    label = "l'ardoise";
    priceCp = dueCp;
    sceneAfter = clearTabAt(sceneBefore, sceneBefore.locationId);
  } else if (choice.direction === "buy") {
    const offer = data.trade.offers.find((o) => o.id === choice.entryId);
    if (!offer) return { error: "offer_not_found" };
    label = quoted(offer.label);
    priceCp = offer.priceCp;
    if (choice.onTab) {
      // Consommé sur place seulement : un objet emporté à crédit devrait aussi entrer dans le sac.
      if (offer.ruleKey) return { error: "tab_services_only" };
      if (!sceneBefore) return { error: "no_tab_here" };
      sceneAfter = addToTab(sceneBefore, { label: offer.label, priceCp: offer.priceCp, creditor });
      if (!sceneAfter) return { error: "tab_full" };
    } else {
      trade = tradeForOffer(offer);
    }
  } else {
    const item = data.trade.items.find((i) => i.id === choice.entryId);
    if (!item) return { error: "item_not_found" };
    label = item.label;
    if (choice.direction === "sell") {
      if (item.resaleCp === null) return { error: "no_resale_price" };
      trade = tradeForSale(item.id, item.resaleCp);
      priceCp = item.resaleCp;
    } else {
      trade = tradeForGift(item.id);
    }
  }

  let missing: TradeMissing[] = [];
  if (trade) {
    const applied = await applyTrade(supabase, { entityId: params.entityId, trade, actorUserId: params.callerId, system });
    if ("error" in applied) {
      if (applied.error === "not_found" || applied.error === "forbidden" || applied.error === "item_not_found" || applied.error === "conflict") return { error: applied.error };
      return { error: "trade_refused" };
    }
    if ("status" in applied) missing = applied.missing;
  }
  const status: "settled" | "short" | "tab" = missing.length > 0 ? "short" : trade ? "settled" : "tab";
  if (status !== "short" && sceneAfter && params.campaignId) {
    await putSceneState(supabase, { campaignId: params.campaignId, state: sceneAfter, updatedBy: params.callerId });
  }

  const facts: string[] = [];
  const price = priceCp === null || priceCp === 0 ? "" : formatCpFr(priceCp);
  if (status === "short") {
    const purseCp = before ? totalValueCp(before.currency, system) : 0;
    for (const line of missing) {
      if (line.kind === "coins") {
        const cost = price ? ` (${price})` : "";
        facts.push(
          purseCp > 0
            ? `${who} tend ${formatCpFr(purseCp)}${to} ; il manque ${formatCpFr(line.missingCp)} pour ${label}${cost}. Rien n'est payé.`
            : `${who} n'a aucune pièce pour payer ${label}${cost}${to}. Rien n'est payé.`
        );
      } else {
        facts.push(`${who} n'a plus ${label} sur soi. Rien n'est échangé.`);
      }
    }
  } else if (status === "tab") {
    facts.push(`${who} prend ${label}${to}, sur l'ardoise${price ? ` (${price})` : ""}. Rien n'est payé pour l'instant.`);
  } else {
    const forPrice = price ? ` pour ${price}` : "";
    if (choice.direction === "settle") facts.push(`${who} règle l'ardoise${to} : ${price}. C'est payé, plus rien n'est dû ici.`);
    else if (choice.direction === "buy") facts.push(`${who} achète ${label}${to}${forPrice}. C'est payé.`);
    else if (choice.direction === "sell") facts.push(`${who} vend ${label}${to}${forPrice}. C'est payé.`);
    else facts.push(`${who} donne ${label}${to}.`);
  }

  const resolution = { settled: "échange réglé", short: "échange court", tab: "mis sur l'ardoise" }[status];
  const payload = {
    intent: params.intent,
    facts,
    resolution,
    trade: {
      direction: choice.direction,
      entry_id: choice.entryId,
      label,
      price_cp: priceCp,
      target_label: creditor,
      status,
      ...(missing.length > 0 ? { missing } : {}),
    },
  };
  const eventId = await journalTurn(supabase, {
    campaignId: params.campaignId,
    callerId: params.callerId,
    entityId: params.entityId,
    kind: "player_action",
    payload,
    inventoryBefore: before,
    sceneBefore,
  });
  return { kind: "player_action", facts, eventId, detail: payload, effects: [] };
}

/**
 * Resout l'intention CHOISIE — celle que l'ecran a montree, corrigee ou
 * non. L'ecran n'envoie jamais un texte libre a resoudre : il envoie un
 * choix explicite, ce qui rend impossible qu'un jet parte sans avoir ete vu.
 *
 * Aucune resolution n'est recrite ici : ce sont les memes fonctions que les
 * boutons de la fiche jouable (`rollWeaponAttack`, V1-B5) et que le volet
 * de des (`rollSkillCheck`, V2-M11) — donc les memes jets, les memes
 * `dice_rolls`, et les declencheurs qu'elles font deja partir.
 */
export async function executeIntent(
  supabase: TypedClient,
  params: {
    entityId: string;
    campaignId: string | null;
    callerId: string;
    world: { id: string; slug: string };
    locale: Locale;
    /** La phrase d'origine, gardee telle quelle dans le journal. */
    text: string;
    /** Vrai si le joueur a change la proposition du moteur — la mesure qui dira quoi ajouter au lexique. */
    corrected: boolean;
    choice: IntentChoice;
  }
): Promise<ResolvedTurnRecord | { error: IntentErrorReason }> {
  const data = await buildIntentBarData(supabase, params);
  if (!data) return { error: "not_found" };

  // Sorti de `params` : le retrecissement d'une union discriminee ne
  // survit pas a une lecture par propriete dans une closure.
  const choice = params.choice;
  const target =
    choice.kind === "free" || choice.targetId === null
      ? null
      : (data.targetDetails.find((t) => t.id === choice.targetId) ?? null);

  const intent = {
    text: params.text,
    kind: choice.kind,
    action_id: choice.kind === "free" ? null : choice.kind === "trade" ? choice.entryId : choice.actionId,
    target_id: target?.id ?? null,
    target_label: target?.label ?? null,
    corrected: params.corrected,
  };

  // Action libre : aucune resolution, et c'est un CHOIX consigne comme tel.
  // Le ticket l'exige explicitement — « un choix explicite, jamais un
  // contournement silencieux ». L'evenement le dit donc en toutes lettres.
  if (choice.kind === "free") {
    const facts = [`${data.actor.name} : ${params.text}`];
    // V3.2-24 : une action jouée sans dé dit pourquoi au narrateur — il raconte l'issue, il ne la juge pas.
    const sansJet = choice.sansJet;
    if (sansJet?.raison === "evidente") facts.push(`Réussite sans jet : action évidente pour ${data.actor.name}.`);
    if (sansJet?.raison === "automatique") facts.push(`${sansJet.what} : réussite automatique contre DD ${sansJet.dc}.`);
    if (sansJet?.raison === "joueur") facts.push(`Joué sans jet, au choix du joueur.`);
    const payload = { intent, facts, resolution: sansJet ? `sans_jet_${sansJet.raison}` : "aucune" };
    const eventId = await journalTurn(supabase, {
    campaignId: params.campaignId,
    callerId: params.callerId,
    entityId: params.entityId,
    kind: "player_action",
    payload,
  });
    return { kind: "player_action", facts, eventId, detail: payload, effects: [] };
  }

  if (choice.kind === "trade") {
    return executeTrade(supabase, { ...params, choice, data, target, intent });
  }

  if (choice.kind === "weapon_attack") {
    const attackRoll = await rollWeaponAttack(supabase, {
      entityId: params.entityId,
      campaignId: params.campaignId,
      itemId: choice.actionId,
      advantage: choice.advantage,
      locale: params.locale,
    });
    if ("error" in attackRoll) return { error: attackRoll.error };
    const attack = attackRoll.attack;
    if (!attack) return { error: "not_a_weapon" };

    // Sans CA connue, il n'y a pas de verdict — et on ne l'invente pas. Le
    // jet reste un fait complet ; c'est la table qui tranche, comme sur un
    // vrai plateau.
    const ac = target?.ac ?? null;
    // Regles 2024, meme verdict que la table (`attackVerdict`, ADR 0042) : un
    // 20 naturel touche, un 1 naturel rate, quelle que soit la CA.
    const verdictAttack = attackVerdict(attack, ac);
    const hit = verdictAttack === null ? null : verdictAttack === "hit";

    const facts: string[] = [];
    const crit = attack.isCritical ? " — critique" : attack.isCriticalFail ? " — échec critique" : "";
    facts.push(
      `${data.actor.name} attaque ${target ? target.label : "sans cible désignée"} avec ${attackRoll.weaponLabel}` +
        ` : ${attack.total} (dé : ${attack.trace[0]?.value ?? attack.total})${advantageLabel(choice.advantage)}` +
        (ac === null ? "" : ` contre CA ${ac} — ${hit ? "touché" : "raté"}`) +
        `${crit}.`
    );

    let damage = null;
    if (hit === true) {
      const damageRoll = await rollWeaponDamage(supabase, {
        entityId: params.entityId,
        campaignId: params.campaignId,
        itemId: choice.actionId,
        critical: attack.isCritical,
        versatile: false,
        lightExtra: choice.extra === "light",
        locale: params.locale,
      });
      if ("error" in damageRoll) return { error: damageRoll.error };
      damage = damageRoll.damage ?? null;
      if (damage) {
        // Les PV de la cible ne bougent pas : appliquer un effet est V3-B2.
        // Le fait est etabli et journalise, ce qui est tout ce dont la
        // narration a besoin — et ce qui permettra de l'appliquer plus tard
        // sans rejouer le de.
        facts.push(`Dégâts sur ${target?.label ?? "la cible"} : ${damage.total}.`);
      }
    }

    const payload = {
      intent,
      facts,
      attack: { expression: attack.expression, total: attack.total, critical: attack.isCritical, critical_fail: attack.isCriticalFail, trace: attack.trace },
      ac,
      verdict: hit === null ? null : hit ? "hit" : "miss",
      damage: damage ? { expression: damage.expression, total: damage.total, trace: damage.trace } : null,
      weapon: attackRoll.weaponLabel,
    };
    const eventId = await journalTurn(supabase, {
    campaignId: params.campaignId,
    callerId: params.callerId,
    entityId: params.entityId,
    kind: "roll",
    payload,
  });
    return { kind: "roll", facts, eventId, detail: payload, effects: [] };
  }

  const rollParams = {
    entityId: params.entityId,
    campaignId: params.campaignId,
    callerId: params.callerId,
    advantage: choice.advantage,
    dc: choice.dc,
    // Un jet cache n'a aucun sens en solo : le joueur EST la table.
    hidden: false,
    locale: params.locale,
  };
  const outcome =
    choice.kind === "skill_check"
      ? await rollSkillCheck(supabase, { ...rollParams, skill: choice.actionId })
      : choice.kind === "ability_check"
        ? await rollAbilityCheck(supabase, { ...rollParams, ability: choice.actionId })
        : await rollSavingThrow(supabase, { ...rollParams, ability: choice.actionId });

  if (!outcome.ok) return { error: outcome.reason };

  const facts = factsFromCheck(data.actor.name, outcome.roll, target);
  const payload = {
    intent,
    facts,
    check: {
      what: outcome.roll.what,
      expression: outcome.roll.expression,
      total: outcome.roll.total,
      dc: outcome.roll.dc,
      verdict: outcome.roll.verdict,
      trace: outcome.roll.trace,
    },
  };
  const eventId = await journalTurn(supabase, {
    campaignId: params.campaignId,
    callerId: params.callerId,
    entityId: params.entityId,
    kind: "roll",
    payload,
  });
  return { kind: "roll", facts, eventId, detail: payload, effects: outcome.roll.triggers?.effects ?? [] };
}

/**
 * V3-B5 — « Le moteur demande un jet, il ne le lance pas. »
 *
 * `executeIntent` (ci-dessus) reste tel quel pour l'action LIBRE — rien à
 * demander, rien à changer, c'est déjà un choix consigné en un temps. Pour
 * une intention MÉCANIQUE, ce qui suit remplace l'ancien réflexe « on lit,
 * on lance, on journalise en un seul appel » par deux temps distincts :
 *
 *   POSER   — `proposeIntentRequest`. Calcule tout ce qu'un jet demanderait
 *             (modificateur, DD, cible) et le FIGE dans
 *             `entity_runtime_state.pending_request`. Aucun dé, aucun
 *             `session_event` : une demande posée n'est pas encore un fait.
 *   ENCAISSER — `resolveIntentRequest`. Reçoit un nombre NU (1 à 20) —
 *             annoncé à la main ou lu sur le volet de dés — et lui ajoute le
 *             modificateur FIGÉ à la pose, jamais recalculé depuis la fiche
 *             au moment d'encaisser (elle a pu changer entre les deux).
 *
 * **Pourquoi le modificateur se fige à la pose.** Un buff appliqué entre la
 * demande et la réponse ne doit ni gonfler ni dégonfler un jet déjà promis
 * au joueur — ce qui a été annoncé (« Attaque, épée longue, +5 ») est ce à
 * quoi le joueur répond, pas une fiche qui aurait bougé sous ses pieds.
 *
 * **Une attaque qui touche CHAÎNE une demande de dégâts** plutôt que de
 * clore la première : c'est la lecture retenue de « un tour peut porter
 * plusieurs jets... ils partent ensemble » — deux annonces consécutives du
 * même tour, jamais un formulaire à deux nombres imposé au joueur.
 *
 * **Ce que ce ticket NE branche PAS encore, et pourquoi ce n'est pas un
 * manque.** Les boutons de la fiche jouable et le volet de dés continuent
 * d'appeler leurs chemins habituels (`rollWeaponAttack`, `rollSkillCheck`...),
 * inchangés — les rendre conscients d'une demande en cours est un chantier
 * séparé, sur des composants PARTAGÉS avec des contextes hors solo (écran
 * Initiative, fiche large, campagne à MJ humain), où une demande n'existe
 * pas et ne doit rien changer. Ce fichier livre le mécanisme central et le
 * chemin « annoncé à la main »/« volet », en accord explicite avec l'auteur
 * (24 septembre) : « le cœur maintenant, la fiche jouable et le volet de
 * dés en suivi ».
 */

/** V3.2-24 : `auto` — le pire jet atteint le DD tiré du palier ; rien n'est posé, la route joue le tour sans dé. */
export type ProposeIntentOutcome = { kind: "pending"; request: PendingRequest } | { kind: "auto"; what: string; dc: number } | { error: IntentErrorReason };

interface PendingBasis {
  kind: PendingRequestKind;
  action_id: string;
  dc: number | null;
  /** Borne haute du nombre nu attendu — voir `zPendingRequest.die_max`. */
  die_max: number;
  modifier: number;
  chips: Source[];
  what: string;
  /** V3.1-156 : dés de bonus de la fiche, lancés par le serveur à la résolution. */
  bonus_dice: { count: number; faces: number; label: string }[];
  /** ADR 0118 : le plancher de chaque dé de dégâts (Armes à deux mains). */
  die_min?: number;
  /** Combat à deux armes : l'attaque en plus d'une arme Légère, transmise aux dégâts chaînés. */
  light_extra?: boolean;
}

const desDeBonus = (dice: readonly BonusDie[]) => dice.map((d) => ({ count: d.count, faces: d.faces, label: d.label }));

/**
 * "1d6" -> 6, "2d6" -> 12 — jamais un modificateur, deja separe dans
 * `abilityMod`. Les degats d'arme (SRD comme homebrew, `weaponProposal.ts`)
 * sont toujours une formule NdM simple ; une autre forme est un bogue en
 * amont, pas un cas a couvrir en silence.
 */
function diceFormulaMax(formula: string): number {
  const match = /^(\d*)d(\d+)$/i.exec(formula.trim());
  if (!match) throw new Error(`Formule de dégâts d'arme inattendue : ${formula}`);
  const count = match[1] === "" ? 1 : Number(match[1]);
  const faces = Number(match[2]);
  return count * faces;
}

/** Ce qu'une intention mécanique demanderait — sans rien lancer. Même trio de resolveurs que `executeIntent` (armes : `characterActions.ts` ; tests/sauvegardes : la fiche dérivée directement, comme `checkRolls.ts` le fait déjà), jamais une quatrième lecture de la fiche. */
function buildPendingBasis(
  ctx: CharacterActionContext,
  choice: RollChoice
): PendingBasis | { error: IntentErrorReason } {
  if (choice.kind === "weapon_attack") {
    const item = ctx.inventoryData?.items.find((i) => i.id === choice.actionId);
    if (!item) return { error: "item_not_found" };
    const ref = itemRef(item);
    const weapon = ref?.kind === "rule" ? ctx.weaponByKey[ref.key] : null;
    if (!weapon) return { error: "not_a_weapon" };
    const ability = weaponAttackAbility(weapon.properties, weapon.isRanged, ctx.sheet.abilities.str.mod, ctx.sheet.abilities.dex.mod);
    // V3.1-156 (ADR 0074) : les bonus des règles du personnage, comme `rollWeaponAttack`.
    const extra = rollBonus(ctx.sheet, { roll: "attack", kind: "weapon", properties: weaponRollProperties(weapon) });
    const modifier = ctx.sheet.abilities[ability].mod + ctx.sheet.proficiencyBonus + extra.value;
    const what = `Attaque — ${itemLabel(item)}${choice.extra === "light" ? " (attaque en plus)" : ""}`;
    return {
      kind: "weapon_attack",
      action_id: choice.actionId,
      dc: null,
      die_max: 20,
      modifier,
      chips: [{ label: what, value: modifier }],
      what,
      bonus_dice: desDeBonus(extra.dice),
      ...(choice.extra === "light" ? { light_extra: true } : {}),
    };
  }

  if (choice.kind === "skill_check") {
    const result = ctx.sheet.skills[choice.actionId];
    return {
      kind: "skill_check",
      action_id: choice.actionId,
      dc: choice.dc,
      die_max: 20,
      modifier: result.mod,
      chips: result.sources,
      what: `${SKILL_LABELS_FR[choice.actionId]} — test de ${ABILITY_LABELS[SKILL_ABILITIES[choice.actionId]]}`,
      bonus_dice: desDeBonus(result.dice),
    };
  }

  if (choice.kind === "ability_check") {
    // V3.1-46 : le jet de caractéristique de la fiche (Touche-à-tout compris).
    const result = ctx.sheet.abilityChecks[choice.actionId];
    return {
      kind: "ability_check",
      action_id: choice.actionId,
      dc: choice.dc,
      die_max: 20,
      modifier: result.mod,
      chips: result.sources,
      what: `Test de ${ABILITY_LABELS[choice.actionId]}`,
      bonus_dice: desDeBonus(result.dice),
    };
  }

  const save = ctx.sheet.savingThrows[choice.actionId];
  return {
    kind: "saving_throw",
    action_id: choice.actionId,
    dc: choice.dc,
    die_max: 20,
    modifier: save.mod,
    chips: save.sources,
    what: `Sauvegarde de ${ABILITY_LABELS[choice.actionId]}`,
    bonus_dice: desDeBonus(save.dice),
  };
}

/**
 * Même calcul que `buildPendingBasis` pour l'arme d'une demande de dégâts
 * CHAÎNÉE après une attaque qui a touché — jamais de DD (les dégâts ne se
 * comparent à rien), jamais de cible pour le modificateur (la cible est
 * déjà fixée par l'attaque). `critical` double `die_max`, jamais le
 * modificateur (même règle que `doubleDiceCounts`, action.ts).
 */
function buildDamageBasis(ctx: CharacterActionContext, itemId: string, critical: boolean, lightExtra = false): PendingBasis | { error: IntentErrorReason } {
  const item = ctx.inventoryData?.items.find((i) => i.id === itemId);
  if (!item) return { error: "item_not_found" };
  const ref = itemRef(item);
  const weapon = ref?.kind === "rule" ? ctx.weaponByKey[ref.key] : null;
  if (!weapon) return { error: "not_a_weapon" };
  const ability = weaponAttackAbility(weapon.properties, weapon.isRanged, ctx.sheet.abilities.str.mod, ctx.sheet.abilities.dex.mod);
  // V3.1-156 (ADR 0074) : la Rage et les bonus de dégâts d'arme, comme `rollWeaponDamage`.
  const extra = rollBonus(ctx.sheet, { roll: "damage", kind: "weapon", ability, properties: weaponRollProperties(weapon), ...(weapon.damageType ? { damageType: weapon.damageType } : {}) });
  // Combat à deux armes : l'attaque en plus d'une arme Légère n'ajoute le modificateur que s'il est négatif, ou avec le don.
  const modCarac = ctx.sheet.abilities[ability].mod;
  const modifier = (lightExtra ? lightExtraDamageMod(modCarac, lightExtraAddsAbility(ctx.sheet)) : modCarac) + extra.value;
  // ADR 0118 : avec de vrais dés, la personne qui joue applique le plancher elle-même ; le libellé le lui dit.
  const plancher = extra.dieMin !== null && extra.dieMin > 1 ? extra.dieMin : null;
  const libelle = `Dégâts — ${itemLabel(item)}${lightExtra ? " (attaque en plus)" : ""}`;
  const what = plancher ? `${libelle} (chaque dé sous ${plancher} compte ${plancher})` : libelle;
  const dieMax = diceFormulaMax(weapon.damageDice) * (critical ? 2 : 1);
  // Les dés de bonus doublent au critique, comme les dés de l'arme.
  const bonus = desDeBonus(extra.dice).map((d) => ({ ...d, count: d.count * (critical ? 2 : 1) }));
  return { kind: "weapon_damage", action_id: itemId, dc: null, die_max: dieMax, modifier, chips: [{ label: libelle, value: modifier }], what, bonus_dice: bonus, ...(plancher ? { die_min: plancher } : {}), ...(lightExtra ? { light_extra: true } : {}) };
}

/**
 * Reservee aux choix MECANIQUES d'une fiche EN campagne. L'action libre et
 * la fiche vue hors campagne n'ont rien a poser — aucun etat de jeu a
 * modifier, aucun jet a differer — et continuent de passer par `playTurn`/
 * `executeIntent`, exactement comme avant ce ticket ; c'est `route.ts` qui
 * fait ce tri, pas cette fonction.
 */
export async function proposeIntentRequest(
  supabase: TypedClient,
  params: {
    entityId: string;
    campaignId: string;
    callerId: string;
    world: { id: string; slug: string };
    locale: Locale;
    text: string;
    corrected: boolean;
    choice: RollChoice;
  }
): Promise<ProposeIntentOutcome> {
  const data = await buildIntentBarData(supabase, params);
  if (!data) return { error: "not_found" };
  const choice = params.choice;
  const target = choice.targetId === null ? null : (data.targetDetails.find((t) => t.id === choice.targetId) ?? null);

  const ctx = await resolveCharacterActionContext(supabase, params.entityId, params.campaignId, params.locale);
  if (!ctx) return { error: "not_found" };

  const basis = buildPendingBasis(ctx, choice);
  if ("error" in basis) return basis;

  // V3.2-24 (ADR 0113) : le palier du classement devient un DD, ici, par le
  // moteur ; et si le pire jet l'atteint, aucun dé ne se pose.
  const tier = choice.kind === "weapon_attack" ? undefined : choice.tier;
  const tierDc = tier ? dcForTier(tier) : null;
  if (tier && tierDc !== null && autoSuccess({ tier, modifier: basis.modifier })) return { kind: "auto", what: basis.what, dc: tierDc };

  const request: PendingRequest = {
    ...basis,
    dc: basis.kind === "weapon_attack" ? (target?.ac ?? null) : (tierDc ?? basis.dc),
    target_id: target?.id ?? null,
    target_label: target?.label ?? null,
    advantage: choice.advantage,
    actor_name: data.actor.name,
    player_action_text: params.text,
    critical: false,
  };

  // « Une nouvelle intention remplace la precedente plutot que de
  // s'empiler — et l'abandon est journalise, jamais silencieux. » Le
  // remplacement lui-meme est deja garanti par `mergeRuntimeState`
  // (jamais un empilement — voir runtimeState.test.ts) ; ce qui manquait
  // ici est la TRACE : sans elle, une demande qui disparait sans reponse
  // ne laisse rien dans le journal pour expliquer pourquoi.
  const previous = await getEntityRuntimeState(supabase, params.entityId, params.campaignId);
  const sessionId = await getOrOpenSessionForCampaign(supabase, params.campaignId);
  const note = previous.pending_request
    ? `Demande abandonnée : « ${previous.pending_request.what} » — remplacée par : ${request.what}`
    : `Jet demandé : ${request.what}`;

  await applyRuntimeStateChange(supabase, {
    entityId: params.entityId,
    campaignId: params.campaignId,
    patch: { pending_request: request },
    note,
    sessionId,
    actor: "system",
  });

  return { kind: "pending", request };
}

export type ResolveIntentErrorReason = "no_pending_request" | "out_of_range" | IntentErrorReason;
/** V3.1-216 : `window` — une réaction peut intervenir, rien n'est joué encore ; la demande reste posée et l'écran attend la réponse. */
export type ResolveIntentOutcome = { record: ResolvedTurnRecord; chained: PendingRequest | null } | { window: string } | { error: ResolveIntentErrorReason };

async function clearPendingRequest(supabase: TypedClient, entityId: string, campaignId: string, sessionId: string): Promise<void> {
  await applyRuntimeStateChange(supabase, { entityId, campaignId, patch: { pending_request: null }, note: "Demande honorée", sessionId, actor: "system" });
}

export type RollOrigin = "volet" | "a_la_main" | "fiche";

/**
 * Encaisse un résultat NU (1 à 20, jamais écrêté — un résultat hors bornes
 * est REFUSÉ, avec un message, plutôt que silencieusement ramené à la
 * borne). `origin` distingue « volet de dés » de « annoncé à la main » :
 * les deux arrivent nus ici, la différence ne compte que pour le journal
 * (V3-D6). La borne haute elle-même n'est PAS 20 dans tous les cas — un
 * dégât d'épée courte plafonne à 6 (12 en critique), jamais 20 : elle vient
 * de `pending.die_max`, fixé à la pose (`buildPendingBasis`/
 * `buildDamageBasis`), d'où le controle en deux temps ci-dessous.
 */
export async function resolveIntentRequest(
  supabase: TypedClient,
  params: {
    entityId: string;
    campaignId: string;
    callerId: string;
    locale: Locale;
    natural: number;
    origin: "volet" | "a_la_main";
  }
): Promise<ResolveIntentOutcome> {
  if (!Number.isInteger(params.natural) || params.natural < 1) {
    return { error: "out_of_range" };
  }

  const state = await getEntityRuntimeState(supabase, params.entityId, params.campaignId);
  const pending = state.pending_request;
  if (!pending) return { error: "no_pending_request" };
  if (params.natural > pending.die_max) return { error: "out_of_range" };

  return finishResolution(supabase, params, pending, params.natural, params.origin);
}

/**
 * V3-B5 Phase 2 — le troisième chemin de réponse : « un bouton de sa fiche,
 * le modificateur est connu, il s'ajoute au clic ». Le naturel n'arrive pas
 * du client ici — un clic de fiche ne demande RIEN au joueur — il est tiré
 * par le SERVEUR, à l'instant, avec les mêmes fonctions que les anciens
 * boutons d'action (`resolveCheckRoll`/`resolveDamageRoll`, `action.ts`) :
 * un modificateur nul isole exactement le jet nu, sans dupliquer la
 * mécanique d'avantage ou de doublement des dés au critique.
 */
export async function resolveIntentRequestFromRoll(
  supabase: TypedClient,
  params: { entityId: string; campaignId: string; callerId: string; locale: Locale }
): Promise<ResolveIntentOutcome> {
  const state = await getEntityRuntimeState(supabase, params.entityId, params.campaignId);
  const pending = state.pending_request;
  if (!pending) return { error: "no_pending_request" };

  let natural: number;
  if (pending.kind === "weapon_damage") {
    const ctx = await resolveCharacterActionContext(supabase, params.entityId, params.campaignId, params.locale);
    if (!ctx) return { error: "not_found" };
    const item = ctx.inventoryData?.items.find((i) => i.id === pending.action_id);
    if (!item) return { error: "item_not_found" };
    const ref = itemRef(item);
    const weapon = ref?.kind === "rule" ? ctx.weaponByKey[ref.key] : null;
    if (!weapon) return { error: "not_a_weapon" };
    natural = resolveDamageRoll({ formula: weapon.damageDice, critical: pending.critical, dieMin: pending.die_min ?? null }, serverRng).total;
  } else {
    natural = resolveCheckRoll({ modifier: 0, advantage: pending.advantage }, serverRng).total;
  }

  return finishResolution(supabase, params, pending, natural, "fiche");
}

/**
 * V3.1-216 — la reprise d'une fenêtre de réaction ouverte dans le tour solo :
 * la demande est toujours posée (rien n'avait été écrit), et le jet arrive
 * déjà arrêté et modifié par les réactions jouées. Aucun dé n'est relancé.
 */
export async function resumeIntentRequest(
  supabase: TypedClient,
  params: { entityId: string; campaignId: string; callerId: string; locale: Locale; origin: RollOrigin; preset: { natural: number | null; total: number } }
): Promise<ResolveIntentOutcome> {
  const state = await getEntityRuntimeState(supabase, params.entityId, params.campaignId);
  const pending = state.pending_request;
  if (!pending) return { error: "no_pending_request" };
  return finishResolution(supabase, params, pending, params.preset.natural ?? 0, params.origin, params.preset);
}

/** Le naturel une fois connu — annoncé, lu sur le volet, ou tiré au clic d'un bouton de fiche — le reste du chemin ne varie plus par origine, seulement dans ce que le journal en dit. */
async function finishResolution(
  supabase: TypedClient,
  params: { entityId: string; campaignId: string; callerId: string; locale: Locale },
  pending: PendingRequest,
  naturalLance: number,
  origin: RollOrigin,
  /** V3.1-216 : le jet DÉJÀ arrêté et modifié par les réactions, à la reprise d'une fenêtre — aucun dé n'est relancé ici. */
  preset?: { natural: number | null; total: number }
): Promise<ResolveIntentOutcome> {
  const originLabel = origin === "a_la_main" ? "annoncé" : origin === "volet" ? "volet de dés" : "depuis la fiche";
  let natural = preset?.natural ?? naturalLance;
  const trace: TraceStep[] = [{ text: originLabel, value: natural }];
  // V3.1-156 (ADR 0074) : les dés de bonus sont lancés ICI par le serveur, quelle que soit l'origine du naturel (règle 8).
  // À la reprise, ils l'ont déjà été avant la fenêtre : leur somme est dans `preset.total`.
  let bonusDice = 0;
  if (!preset) {
    for (const d of pending.bonus_dice ?? []) {
      // ADR 0118 : le plancher des dés de dégâts vaut aussi pour les dés de bonus de l'attaque.
      const r = rollDice(d.count, d.faces, flooredRng(serverRng, pending.die_min));
      bonusDice += r.total;
      trace.push({ text: `${d.count}d${d.faces} ${d.label} (${r.rolls.join(", ")})`, value: r.total });
    }
  }
  let total = preset ? preset.total : natural + pending.modifier + bonusDice;

  // La fiche : lue une seule fois pour tout le reste de la résolution (le
  // point de décision, les dégâts chaînés, les déclencheurs du test).
  const ctx = await resolveCharacterActionContext(supabase, params.entityId, params.campaignId, params.locale);

  // V3.1-216 — le point de décision du tour solo : tant qu'une réaction peut
  // intervenir, RIEN n'est écrit (la demande reste posée, le dé n'est pas
  // relancé) ; la reprise repassera ici avec `preset`.
  if (!preset && ctx) {
    const fenetre = await soloRollWindow(supabase, { ctx, campaignId: params.campaignId, callerId: params.callerId, locale: params.locale, pending, natural, total, origin });
    if (fenetre.kind === "window") return { window: fenetre.windowId };
    if (fenetre.names !== null) {
      natural = fenetre.natural ?? natural;
      total = fenetre.total;
      trace.push({ text: `réaction — ${fenetre.names}`, value: total });
    }
  } else if (preset) {
    trace.push({ text: "après réaction", value: total });
  }

  const ast = parseFormula(String(Math.max(0, total)));
  const expression = `${natural} (${originLabel}) + ${pending.modifier}${(pending.bonus_dice ?? []).map((d) => ` + ${d.count}d${d.faces}`).join("")}`;
  const sessionId = await getOrOpenSessionForCampaign(supabase, params.campaignId);

  // V3.1-89 : nature du jet et d20 gardé. Un naturel annoncé à la main (vrai dé
  // à table) compte, mais seulement s'il est un d20 plausible (1 à 20).
  const attributionKind: DiceRollKind =
    pending.kind === "weapon_attack" ? "attack" : pending.kind === "weapon_damage" ? "damage" : pending.kind === "saving_throw" ? "save" : "check";
  const naturalD20 = attributionKind !== "damage" && Number.isInteger(natural) && natural >= 1 && natural <= 20 ? natural : undefined;

  async function recordDiceRoll(what: string, dc: number | null, verdict: "success" | "fail" | null, extra: Json) {
    await insertDiceRoll(supabase, {
      sessionId,
      campaignId: params.campaignId,
      expression,
      ast: ast as unknown as Json,
      context: { modifier: pending.modifier, origin } as unknown as Json,
      result: total,
      detail: { who: pending.actor_name, what, chips: pending.chips, dc, verdict, trace, origin, ...(typeof extra === "object" && extra ? extra : {}) } as unknown as Json,
      rolledBy: "player",
      visibilityLevel: "public",
      attribution: { entityId: params.entityId, kind: attributionKind, ...(naturalD20 !== undefined ? { naturalD20 } : {}) },
    });
  }

  if (pending.kind === "weapon_attack") {
    // Critique amélioré (Champion) : le critique suit la plage des règles du personnage, plus seulement le 20.
    const isCritical = natural >= (ctx ? soloCritRange(ctx, pending) : 20);
    const isCriticalFail = natural === 1;
    // Regles 2024 (`attackVerdict`) : le naturel decide avant le total.
    const verdictAttack = attackVerdict({ total, isCritical, isCriticalFail }, pending.dc);
    const hit = verdictAttack === null ? null : verdictAttack === "hit";
    await recordDiceRoll(pending.what, pending.dc, hit === null ? null : hit ? "success" : "fail", { isCritical, isCriticalFail });

    const crit = isCritical ? " — critique" : isCriticalFail ? " — échec critique" : "";
    const facts = [
      `${pending.actor_name} attaque ${pending.target_label ?? "sans cible désignée"} avec ${pending.what.replace("Attaque — ", "")}` +
        ` : ${total} (dé : ${natural})` +
        (pending.dc === null ? "" : ` contre CA ${pending.dc} — ${hit ? "touché" : "raté"}`) +
        `${crit}.`,
    ];
    const intent = {
      text: pending.player_action_text,
      kind: pending.kind,
      action_id: pending.action_id,
      target_id: pending.target_id,
      target_label: pending.target_label,
      corrected: false,
    };
    const payload = {
      intent,
      facts,
      attack: { expression, total, critical: isCritical, critical_fail: isCriticalFail, trace },
      ac: pending.dc,
      verdict: hit === null ? null : hit ? "hit" : "miss",
      damage: null,
      weapon: pending.what,
      origin,
    };
    const eventId = await journalTurn(supabase, { campaignId: params.campaignId, callerId: params.callerId, entityId: params.entityId, kind: "roll", payload });

    let chained: PendingRequest | null = null;
    if (hit === true) {
      const basis = ctx ? buildDamageBasis(ctx, pending.action_id, isCritical, pending.light_extra === true) : { error: "not_found" as const };
      if (!("error" in basis)) {
        chained = {
          ...basis,
          target_id: pending.target_id,
          target_label: pending.target_label,
          advantage: "normal",
          actor_name: pending.actor_name,
          player_action_text: pending.player_action_text,
          critical: isCritical,
        };
      }
    }
    if (chained) {
      await applyRuntimeStateChange(supabase, {
        entityId: params.entityId,
        campaignId: params.campaignId,
        patch: { pending_request: chained },
        note: `Jet demandé : ${chained.what}`,
        sessionId,
        actor: "system",
      });
    } else {
      await clearPendingRequest(supabase, params.entityId, params.campaignId, sessionId);
    }

    return { record: { kind: "roll", facts, eventId, detail: payload, effects: [] }, chained };
  }

  if (pending.kind === "weapon_damage") {
    await recordDiceRoll(pending.what, null, null, { critical: pending.critical });
    const facts = [`Dégâts sur ${pending.target_label ?? "la cible"} : ${total}.`];
    const intent = {
      text: pending.player_action_text,
      kind: pending.kind,
      action_id: pending.action_id,
      target_id: pending.target_id,
      target_label: pending.target_label,
      corrected: false,
    };
    const payload = {
      intent,
      facts,
      attack: null,
      ac: null,
      verdict: null,
      damage: { expression, total, trace },
      weapon: pending.what,
      origin,
    };
    const eventId = await journalTurn(supabase, { campaignId: params.campaignId, callerId: params.callerId, entityId: params.entityId, kind: "roll", payload });
    await clearPendingRequest(supabase, params.entityId, params.campaignId, sessionId);
    return { record: { kind: "roll", facts, eventId, detail: payload, effects: [] }, chained: null };
  }

  // skill_check / ability_check / saving_throw : meme forme de fait et de
  // payload que `executeIntent`, meme declencheurs que le chemin fiche
  // (`fireForRoll`, exportee de checkRolls.ts pour ne pas la reecrire).
  const verdict: "success" | "fail" | null = pending.dc === null ? null : total >= pending.dc ? "success" : "fail";
  await recordDiceRoll(pending.what, pending.dc, verdict, {});

  let firedTriggers: ResolvedEffect[] = [];
  if (ctx) {
    const events: ((passed: boolean, total: number, dc: number) => FiredEvent[]) | null =
      pending.kind === "skill_check"
        ? (passed, t, dc) => eventsForCheck({ who: ctx.entityId, kind: "skill", key: pending.action_id as Skill, ability: SKILL_ABILITIES[pending.action_id as Skill], passed, total: t, dc })
        : pending.kind === "ability_check"
          ? (passed, t, dc) => eventsForCheck({ who: ctx.entityId, kind: "ability", key: pending.action_id as Ability, ability: pending.action_id as Ability, passed, total: t, dc })
          : pending.kind === "saving_throw"
            ? (passed, t, dc) => eventsForSave({ who: ctx.entityId, passed, total: t, dc })
            : null;
    if (events) {
      const fired = await fireForRoll(supabase, { ctx, sheet: ctx.sheet, events }, verdict, total, pending.dc);
      firedTriggers = fired?.effects ?? [];
    }
  }

  const facts = [
    `${pending.actor_name} — ${pending.what}${pending.target_label ? ` sur ${pending.target_label}` : ""} : ${total} (dé : ${natural})` +
      (pending.dc === null ? "" : ` contre DD ${pending.dc}`) +
      (verdict === null ? "" : verdict === "success" ? " — réussite" : " — échec") +
      ".",
  ];
  const intent = {
    text: pending.player_action_text,
    kind: pending.kind,
    action_id: pending.action_id,
    target_id: pending.target_id,
    target_label: pending.target_label,
    corrected: false,
  };
  const payload = {
    intent,
    facts,
    check: { what: pending.what, expression, total, dc: pending.dc, verdict, trace },
    origin,
  };
  const eventId = await journalTurn(supabase, { campaignId: params.campaignId, callerId: params.callerId, entityId: params.entityId, kind: "roll", payload });
  await clearPendingRequest(supabase, params.entityId, params.campaignId, sessionId);
  return { record: { kind: "roll", facts, eventId, detail: payload, effects: firedTriggers }, chained: null };
}
