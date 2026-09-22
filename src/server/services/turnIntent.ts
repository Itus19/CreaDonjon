import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import type { Locale } from "@/src/i18n/request";
import {
  ABILITIES,
  ABILITY_LABELS,
  SKILLS,
  type Ability,
  type Skill,
} from "@/src/core/rules/sheet";
import { SKILL_LABELS_FR, INTENT_VERBS_FR } from "@/src/i18n/fr";
import { type IntentAction, type IntentTarget } from "@/src/core/rules/intent";
import type { AdvantageState } from "@/src/core/rules/action";
import type { BlockReference } from "@/src/core/schemas/blocks/reference";
import type { InventoryItem } from "@/src/core/schemas/blocks/inventory";
import {
  resolveCharacterActionContext,
  rollWeaponAttack,
  rollWeaponDamage,
  type ActionErrorReason,
} from "@/src/server/services/characterActions";
import {
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
import { getOrOpenSessionForCampaign } from "@/src/server/services/sessions";
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

function itemRef(item: InventoryItem): BlockReference | null {
  return (item as { ref?: BlockReference }).ref ?? null;
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
  const targets: IntentTarget[] = targetDetails.map((t) => ({ id: t.id, label: t.label, terms: [t.label] }));

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

function factsFromCheck(who: string, roll: RollOutcome, target: IntentTargetDetail | null): string[] {
  const against = target ? ` sur ${target.label}` : "";
  const verdict = roll.verdict === null ? "" : roll.verdict === "success" ? " — réussite" : " — échec";
  const dc = roll.dc === null ? "" : ` contre DD ${roll.dc}`;
  return [`${who} — ${roll.what}${against} : ${roll.expression} = ${roll.total}${dc}${verdict}.`];
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
): Promise<TurnRecord | { error: IntentErrorReason }> {
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
    return { kind: "player_action", facts, eventId, detail: payload };
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
        ` : ${attack.expression} = ${attack.total}${advantageLabel(choice.advantage)}` +
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
        facts.push(`Dégâts sur ${target?.label ?? "la cible"} : ${damage.expression} = ${damage.total}.`);
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
    return { kind: "roll", facts, eventId, detail: payload };
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
  return { kind: "roll", facts, eventId, detail: payload };
}
