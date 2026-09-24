import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import type { Locale } from "@/src/i18n/request";
import {
  ABILITIES,
  ABILITY_LABELS,
  SKILLS,
  SKILL_ABILITIES,
  type Ability,
  type Skill,
  type Source,
} from "@/src/core/rules/sheet";
import { SKILL_LABELS_FR, INTENT_VERBS_FR } from "@/src/i18n/fr";
import { type IntentAction, type IntentTarget } from "@/src/core/rules/intent";
import type { ResolvedEffect, FiredEvent } from "@/src/core/rules/triggers";
import { weaponAttackAbilityMod, type AdvantageState } from "@/src/core/rules/action";
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
import { listCombatsForCampaign, listCombatParticipants } from "@/src/server/repos/combats";
import { listEntitiesByIds } from "@/src/server/repos/entities";
import { insertSessionEvent, nextEventSeq } from "@/src/server/repos/sessions";
import { insertDiceRoll } from "@/src/server/repos/diceRolls";
import { getOrOpenSessionForCampaign } from "@/src/server/services/sessions";
import { applyRuntimeStateChange, getEntityRuntimeState } from "@/src/server/services/runtimeState";
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
  params: { campaignId: string | null; actorEntityId: string }
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

  const scene = await getSceneState(supabase, params.campaignId);
  const scenePresent = (scene?.present ?? []).map((p) => p.entityId).filter((id) => !seenEntityIds.has(id));
  if (scenePresent.length > 0) {
    for (const entity of await listEntitiesByIds(supabase, scenePresent)) {
      details.push({ id: `entity:${entity.id}`, label: entity.name, ac: null, hpCurrent: null, source: "scene" });
    }
  }

  return details;
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
  const equippedWeapons = (ctx.inventoryData?.items ?? []).filter((item) => {
    if (!item.equipped) return false;
    const ref = itemRef(item);
    return ref?.kind === "rule" && Boolean(ctx.weaponByKey[ref.key]);
  });

  // Le nom FRANCAIS de l'arme, pas sa cle SRD : le joueur ecrit « épée
  // longue », jamais « longsword ».
  const weaponRefs = equippedWeapons.map(itemRef).filter((r): r is BlockReference => r !== null);
  const chips = await resolveBlockReferences(supabase, params.world, ctx.rulesetId, params.locale, weaponRefs);

  const actions: IntentAction[] = [];
  equippedWeapons.forEach((item, index) => {
    const name = chips[index]?.name ?? "";
    actions.push({
      id: item.id,
      kind: "weapon_attack",
      label: name || "Arme",
      terms: name ? [name] : [],
    });
  });
  for (const skill of SKILLS) {
    actions.push({ id: skill, kind: "skill_check", label: SKILL_LABELS_FR[skill], terms: [SKILL_LABELS_FR[skill]] });
  }
  for (const ability of ABILITIES) {
    // « test de Force », jamais « force » tout court : le mot est trop
    // courant en francais pour servir de declencheur de jet.
    actions.push({
      id: ability,
      kind: "ability_check",
      label: `Test de ${ABILITY_LABELS[ability]}`,
      terms: [`test de ${ABILITY_LABELS[ability]}`, `jet de ${ABILITY_LABELS[ability]}`],
    });
    actions.push({
      id: ability,
      kind: "saving_throw",
      label: `Sauvegarde de ${ABILITY_LABELS[ability]}`,
      terms: [`sauvegarde de ${ABILITY_LABELS[ability]}`, `jet de sauvegarde de ${ABILITY_LABELS[ability]}`],
    });
  }

  const targetDetails = await loadTargets(supabase, { campaignId: params.campaignId, actorEntityId: params.entityId });
  const targets: IntentTarget[] = targetDetails.map((t) => ({ id: t.id, label: t.label, terms: targetTerms(t.label) }));

  return {
    actor: { entityId: ctx.entityId, name: ctx.entityName },
    catalog: { actions, targets, verbs: INTENT_VERBS_FR },
    targetDetails,
  };
}

export type IntentChoice =
  | { kind: "weapon_attack"; actionId: string; targetId: TargetId | null; advantage: AdvantageState }
  | { kind: "skill_check"; actionId: Skill; targetId: TargetId | null; advantage: AdvantageState; dc: number | null }
  | { kind: "ability_check"; actionId: Ability; targetId: TargetId | null; advantage: AdvantageState; dc: number | null }
  | { kind: "saving_throw"; actionId: Ability; targetId: TargetId | null; advantage: AdvantageState; dc: number | null }
  | { kind: "free" };

/** Les raisons des deux resolveurs reutilises, sans en inventer une : `characterActions` pour les armes, `checkRolls` pour les tests. */
export type IntentErrorReason = ActionErrorReason | CheckRollErrorReason;


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
    kind: "roll" | "player_action";
    payload: Record<string, unknown>;
  }
): Promise<string | null> {
  if (!params.campaignId) return null;
  const sessionId = await getOrOpenSessionForCampaign(supabase, params.campaignId);
  const seq = await nextEventSeq(supabase, sessionId);
  const event = await insertSessionEvent(supabase, {
    sessionId,
    seq,
    kind: params.kind,
    actor: "player",
    actorUserId: params.callerId,
    payload: { __v: 1, ...params.payload } as unknown as Json,
  });
  return event.id;
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
    action_id: choice.kind === "free" ? null : choice.actionId,
    target_id: target?.id ?? null,
    target_label: target?.label ?? null,
    corrected: params.corrected,
  };

  // Action libre : aucune resolution, et c'est un CHOIX consigne comme tel.
  // Le ticket l'exige explicitement — « un choix explicite, jamais un
  // contournement silencieux ». L'evenement le dit donc en toutes lettres.
  if (choice.kind === "free") {
    const facts = [`${data.actor.name} : ${params.text}`];
    const payload = { intent, facts, resolution: "aucune" };
    const eventId = await journalTurn(supabase, {
    campaignId: params.campaignId,
    callerId: params.callerId,
    kind: "player_action",
    payload,
  });
    return { kind: "player_action", facts, eventId, detail: payload, effects: [] };
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
    const hit = ac === null ? null : attack.total >= ac;

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
      attack: { expression: attack.expression, total: attack.total, critical: attack.isCritical, trace: attack.trace },
      ac,
      verdict: hit === null ? null : hit ? "hit" : "miss",
      damage: damage ? { expression: damage.expression, total: damage.total, trace: damage.trace } : null,
      weapon: attackRoll.weaponLabel,
    };
    const eventId = await journalTurn(supabase, {
    campaignId: params.campaignId,
    callerId: params.callerId,
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

export type ProposeIntentOutcome = { kind: "pending"; request: PendingRequest } | { error: IntentErrorReason };

interface PendingBasis {
  kind: PendingRequestKind;
  action_id: string;
  dc: number | null;
  /** Borne haute du nombre nu attendu — voir `zPendingRequest.die_max`. */
  die_max: number;
  modifier: number;
  chips: Source[];
  what: string;
}

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
  choice: Exclude<IntentChoice, { kind: "free" }>
): PendingBasis | { error: IntentErrorReason } {
  if (choice.kind === "weapon_attack") {
    const item = ctx.inventoryData?.items.find((i) => i.id === choice.actionId);
    if (!item) return { error: "item_not_found" };
    const ref = itemRef(item);
    const weapon = ref?.kind === "rule" ? ctx.weaponByKey[ref.key] : null;
    if (!weapon) return { error: "not_a_weapon" };
    const abilityMod = weaponAttackAbilityMod(weapon.properties, weapon.isRanged, ctx.sheet.abilities.str.mod, ctx.sheet.abilities.dex.mod);
    const modifier = abilityMod + ctx.sheet.proficiencyBonus;
    const what = `Attaque — ${itemLabel(item)}`;
    return { kind: "weapon_attack", action_id: choice.actionId, dc: null, die_max: 20, modifier, chips: [{ label: what, value: modifier }], what };
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
    };
  }

  if (choice.kind === "ability_check") {
    const mod = ctx.sheet.abilities[choice.actionId].mod;
    return {
      kind: "ability_check",
      action_id: choice.actionId,
      dc: choice.dc,
      die_max: 20,
      modifier: mod,
      chips: [{ label: ABILITY_LABELS[choice.actionId], value: mod }],
      what: `Test de ${ABILITY_LABELS[choice.actionId]}`,
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
  };
}

/**
 * Même calcul que `buildPendingBasis` pour l'arme d'une demande de dégâts
 * CHAÎNÉE après une attaque qui a touché — jamais de DD (les dégâts ne se
 * comparent à rien), jamais de cible pour le modificateur (la cible est
 * déjà fixée par l'attaque). `critical` double `die_max`, jamais le
 * modificateur (même règle que `doubleDiceCounts`, action.ts).
 */
function buildDamageBasis(ctx: CharacterActionContext, itemId: string, critical: boolean): PendingBasis | { error: IntentErrorReason } {
  const item = ctx.inventoryData?.items.find((i) => i.id === itemId);
  if (!item) return { error: "item_not_found" };
  const ref = itemRef(item);
  const weapon = ref?.kind === "rule" ? ctx.weaponByKey[ref.key] : null;
  if (!weapon) return { error: "not_a_weapon" };
  const abilityMod = weaponAttackAbilityMod(weapon.properties, weapon.isRanged, ctx.sheet.abilities.str.mod, ctx.sheet.abilities.dex.mod);
  const what = `Dégâts — ${itemLabel(item)}`;
  const dieMax = diceFormulaMax(weapon.damageDice) * (critical ? 2 : 1);
  return { kind: "weapon_damage", action_id: itemId, dc: null, die_max: dieMax, modifier: abilityMod, chips: [{ label: what, value: abilityMod }], what };
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
    choice: Exclude<IntentChoice, { kind: "free" }>;
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

  const request: PendingRequest = {
    ...basis,
    dc: basis.kind === "weapon_attack" ? (target?.ac ?? null) : basis.dc,
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
export type ResolveIntentOutcome = { record: ResolvedTurnRecord; chained: PendingRequest | null } | { error: ResolveIntentErrorReason };

async function clearPendingRequest(supabase: TypedClient, entityId: string, campaignId: string, sessionId: string): Promise<void> {
  await applyRuntimeStateChange(supabase, { entityId, campaignId, patch: { pending_request: null }, note: "Demande honorée", sessionId, actor: "system" });
}

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

  const total = params.natural + pending.modifier;
  const originLabel = params.origin === "a_la_main" ? "annoncé" : "volet de dés";
  const trace: TraceStep[] = [{ text: originLabel, value: params.natural }];
  const ast = parseFormula(String(Math.max(0, total)));
  const expression = `${params.natural} (${originLabel}) + ${pending.modifier}`;
  const sessionId = await getOrOpenSessionForCampaign(supabase, params.campaignId);

  async function recordDiceRoll(what: string, dc: number | null, verdict: "success" | "fail" | null, extra: Json) {
    await insertDiceRoll(supabase, {
      sessionId,
      campaignId: params.campaignId,
      expression,
      ast: ast as unknown as Json,
      context: { modifier: pending!.modifier, origin: params.origin } as unknown as Json,
      result: total,
      detail: { who: pending!.actor_name, what, chips: pending!.chips, dc, verdict, trace, origin: params.origin, ...(typeof extra === "object" && extra ? extra : {}) } as unknown as Json,
      rolledBy: "player",
      visibilityLevel: "public",
    });
  }

  if (pending.kind === "weapon_attack") {
    const isCritical = params.natural === 20;
    const isCriticalFail = params.natural === 1;
    const hit = pending.dc === null ? null : total >= pending.dc;
    await recordDiceRoll(pending.what, pending.dc, hit === null ? null : hit ? "success" : "fail", { isCritical, isCriticalFail });

    const crit = isCritical ? " — critique" : isCriticalFail ? " — échec critique" : "";
    const facts = [
      `${pending.actor_name} attaque ${pending.target_label ?? "sans cible désignée"} avec ${pending.what.replace("Attaque — ", "")}` +
        ` : ${total} (dé : ${params.natural})` +
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
      attack: { expression, total, critical: isCritical, trace },
      ac: pending.dc,
      verdict: hit === null ? null : hit ? "hit" : "miss",
      damage: null,
      weapon: pending.what,
      origin: params.origin,
    };
    const eventId = await journalTurn(supabase, { campaignId: params.campaignId, callerId: params.callerId, kind: "roll", payload });

    let chained: PendingRequest | null = null;
    if (hit === true) {
      const ctx = await resolveCharacterActionContext(supabase, params.entityId, params.campaignId, params.locale);
      const basis = ctx ? buildDamageBasis(ctx, pending.action_id, isCritical) : { error: "not_found" as const };
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
      origin: params.origin,
    };
    const eventId = await journalTurn(supabase, { campaignId: params.campaignId, callerId: params.callerId, kind: "roll", payload });
    await clearPendingRequest(supabase, params.entityId, params.campaignId, sessionId);
    return { record: { kind: "roll", facts, eventId, detail: payload, effects: [] }, chained: null };
  }

  // skill_check / ability_check / saving_throw : meme forme de fait et de
  // payload que `executeIntent`, meme declencheurs que le chemin fiche
  // (`fireForRoll`, exportee de checkRolls.ts pour ne pas la reecrire).
  const verdict: "success" | "fail" | null = pending.dc === null ? null : total >= pending.dc ? "success" : "fail";
  await recordDiceRoll(pending.what, pending.dc, verdict, {});

  const ctx = await resolveCharacterActionContext(supabase, params.entityId, params.campaignId, params.locale);
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
    `${pending.actor_name} — ${pending.what}${pending.target_label ? ` sur ${pending.target_label}` : ""} : ${total} (dé : ${params.natural})` +
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
    origin: params.origin,
  };
  const eventId = await journalTurn(supabase, { campaignId: params.campaignId, callerId: params.callerId, kind: "roll", payload });
  await clearPendingRequest(supabase, params.entityId, params.campaignId, sessionId);
  return { record: { kind: "roll", facts, eventId, detail: payload, effects: firedTriggers }, chained: null };
}
