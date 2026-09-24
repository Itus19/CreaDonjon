import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import type { Locale } from "@/src/i18n/request";
import { advanceTime, budgetOf, rememberEvent, startTurn, type SceneState } from "@/src/core/rules/scene";
import { spendFromBudget, type BudgetKind } from "@/src/core/rules/actionBudget";
import { applyEffects, type TurnActor, type TurnChange } from "@/src/core/rules/turn";
import { eventsForAttack } from "@/src/core/rules/gameEvents";
import type { AttackRollResult } from "@/src/core/rules/action";
import type { ResolvedEffect } from "@/src/core/rules/triggers";
import { resolveCharacterActionContext } from "@/src/server/services/characterActions";
import {
  executeIntent,
  resolveIntentRequest,
  resolveIntentRequestFromRoll,
  type IntentChoice,
  type IntentErrorReason,
  type ResolvedTurnRecord,
  type ResolveIntentErrorReason,
} from "@/src/server/services/turnIntent";
import type { PendingRequest, PendingRequestKind } from "@/src/core/schemas/runtimeState";
import { fireTriggersForCharacter } from "@/src/server/services/triggerRuntime";
import { getEntityRuntimeState, applyRuntimeStateChange } from "@/src/server/services/runtimeState";
import { patchCombatParticipant } from "@/src/server/services/combats";
import { getCombatParticipantById, listCombatParticipants, listCombatsForCampaign } from "@/src/server/repos/combats";
import { getSceneState, putSceneState } from "@/src/server/repos/sceneStates";
import { insertSessionEvent, nextEventSeq } from "@/src/server/repos/sessions";
import { getOrOpenSessionForCampaign } from "@/src/server/services/sessions";
import type { TurnOutcome } from "@/lib/solo/types";

type TypedClient = SupabaseClient<Database>;

/**
 * V3-B2 — Le tour, de bout en bout.
 *
 * B1 a rendu la mecanique inevitable ; il s'arretait au fait etabli. Ici le
 * fait produit ses consequences : les declencheurs partent, leurs effets
 * sont APPLIQUES, la scene avance, et chaque etape laisse sa trace.
 *
 * **Chaque etape journalise independamment**, et c'est la propriete
 * centrale du ticket. Le jet est ecrit par B1 avant que quoi que ce soit
 * d'autre n'arrive ; l'application des effets est son propre evenement ;
 * la scene est ecrite ensuite. Si l'une tombe, les precedentes tiennent —
 * un tour a moitie joue reste un tour joue, jamais un tour perdu.
 *
 * **Le tour tourne entierement sans IA.** Aucun modele n'est appele ici :
 * c'est le critere transverse le plus important du lot B (« le solo doit
 * rester jouable sans IA du tout »). La narration se branchera par-dessus,
 * apres, et son echec ne pourra rien retirer de ce qui est ecrit ici.
 */

/** Ce qu'un tour coute, par famille d'intention. Une seule table, lisible d'un coup d'oeil. */
const BUDGET_COST: Record<IntentChoice["kind"], BudgetKind> = {
  weapon_attack: "action",
  skill_check: "action",
  ability_check: "action",
  saving_throw: "free",
  free: "free",
};

/**
 * Combien de temps prend un tour.
 *
 * En combat, l'horloge ne bouge pas : un round dure six secondes et
 * `GameTime` compte en minutes — faire avancer d'une minute par attaque
 * ferait vieillir la partie de vingt minutes pendant un echange de coups.
 * Hors combat, une action resolue vaut une minute. Grossier, assume, et
 * surtout : c'est le CODE qui le decide, jamais un modele (ADR 0009, trou
 * n° 1).
 */
function minutesForTurn(scene: SceneState): number {
  return scene.activeCombatId ? 0 : 1;
}

/** Les PV d'un participant de combat, ou ceux de l'etat de jeu d'une entite. */
async function loadActor(
  supabase: TypedClient,
  params: { campaignId: string; entityId: string; hpMax: number; budgetSpeed: number; scene: SceneState | null }
): Promise<TurnActor> {
  const state = await getEntityRuntimeState(supabase, params.entityId, params.campaignId);
  return {
    hp: { current: state.hp.current, max: params.hpMax, temp: state.hp.temp },
    conditions: [...state.conditions],
    resources: { ...state.resources },
    budget: params.scene ? budgetOf(params.scene, params.entityId, params.budgetSpeed) : { action: 1, bonus: 1, reaction: 1, movement: params.budgetSpeed, free: 1 },
  };
}

/** Une phrase par changement — c'est ce que l'ecran affiche et ce que la narration recevra. */
function describeChange(change: TurnChange, nameOf: (id: string) => string): string | null {
  switch (change.kind) {
    case "hp":
      return `${nameOf(change.who)} : ${change.from.current} → ${change.to.current} PV (${change.note})`;
    case "condition":
      return `${nameOf(change.who)} ${change.added ? "subit" : "n'a plus"} : ${change.key}`;
    case "zone":
      return `${nameOf(change.who)} passe de ${change.from} à ${change.to}`;
    case "budget":
      return `${nameOf(change.who)} — ${change.budget} : ${change.from} → ${change.to}${change.overBudget ? " (hors budget)" : ""}`;
    case "resource":
      return `${nameOf(change.who)} — ${change.key} : ${change.from} → ${change.to}`;
    case "roll":
      return `${change.label} : ${change.value}${change.note ? ` — ${change.note}` : ""}`;
    case "hint":
    case "ignored":
      return null;
  }
}

export async function playTurn(
  supabase: TypedClient,
  params: {
    entityId: string;
    campaignId: string;
    callerId: string;
    world: { id: string; slug: string };
    locale: Locale;
    text: string;
    corrected: boolean;
    choice: IntentChoice;
  }
): Promise<TurnOutcome | { error: IntentErrorReason }> {
  // La mecanique, telle que B1 la resout — et telle qu'elle se journalise,
  // AVANT tout le reste.
  const record = await executeIntent(supabase, params);
  if ("error" in record) return record;

  return applyResolvedTurn(
    supabase,
    { entityId: params.entityId, campaignId: params.campaignId, callerId: params.callerId, locale: params.locale, text: params.text, choiceKind: params.choice.kind },
    record
  );
}

/**
 * V3-B5 — Le pendant « demande posee, puis encaissee » de `playTurn`.
 *
 * `resolveIntentRequest` (turnIntent.ts) rend le meme `ResolvedTurnRecord`
 * qu'`executeIntent` — c'est exactement ce qui permet de rejoindre ici le
 * MEME pipeline (effets, budget, persistance, journal, scene) sans le
 * reecrire. Ce que `playEncashedTurn` ajoute par-dessus est propre a
 * l'encaissement : retrouver la phrase d'origine et le genre d'intention
 * dans le fait resolu (la demande, elle, ne les portait que le temps d'etre
 * en attente), et rendre `chained` — la demande de degats posee a la suite
 * d'une attaque qui a touche, que l'ecran doit maintenant montrer.
 */
export async function playEncashedTurn(
  supabase: TypedClient,
  params: {
    entityId: string;
    campaignId: string;
    callerId: string;
    locale: Locale;
    natural: number;
    origin: "volet" | "a_la_main";
  }
): Promise<(TurnOutcome & { chained: PendingRequest | null }) | { error: ResolveIntentErrorReason }> {
  const outcome = await resolveIntentRequest(supabase, params);
  if ("error" in outcome) return outcome;
  return finishEncashedTurn(supabase, params, outcome);
}

/**
 * V3-B5 Phase 2 — « un bouton de sa fiche : le modificateur est connu, il
 * s'ajoute au clic. » Meme demande, meme pipeline que `playEncashedTurn` —
 * seule differe la SOURCE du naturel : `resolveIntentRequestFromRoll`
 * (turnIntent.ts) le tire elle-meme, cote serveur, au lieu de le recevoir
 * du client. Rien d'autre ne change, d'ou la meme fonction de fin
 * (`finishEncashedTurn`) que le chemin « annonce a la main »/« volet ».
 */
export async function playEncashedTurnFromRoll(
  supabase: TypedClient,
  params: { entityId: string; campaignId: string; callerId: string; locale: Locale }
): Promise<(TurnOutcome & { chained: PendingRequest | null }) | { error: ResolveIntentErrorReason }> {
  const outcome = await resolveIntentRequestFromRoll(supabase, params);
  if ("error" in outcome) return outcome;
  return finishEncashedTurn(supabase, params, outcome);
}

async function finishEncashedTurn(
  supabase: TypedClient,
  params: { entityId: string; campaignId: string; callerId: string; locale: Locale },
  outcome: { record: ResolvedTurnRecord; chained: PendingRequest | null }
): Promise<TurnOutcome & { chained: PendingRequest | null }> {
  const intent = outcome.record.detail.intent as { text: string; kind: PendingRequestKind };
  // Les degats chaines par une attaque qui a touche ne sont pas une action
  // a part : ils ne rouvrent pas le tour, ne depensent rien, ne font pas
  // avancer l'horloge une seconde fois pour le meme coup. `choiceKind: null`
  // porte exactement cette distinction jusque dans `applyResolvedTurn`.
  const choiceKind: IntentChoice["kind"] | null = intent.kind === "weapon_damage" ? null : intent.kind;

  const turn = await applyResolvedTurn(
    supabase,
    { entityId: params.entityId, campaignId: params.campaignId, callerId: params.callerId, locale: params.locale, text: intent.text, choiceKind },
    outcome.record
  );
  return { ...turn, chained: outcome.chained };
}

async function applyResolvedTurn(
  supabase: TypedClient,
  params: {
    entityId: string;
    campaignId: string;
    callerId: string;
    locale: Locale;
    text: string;
    /** `null` pour une resolution chainee (degats d'une attaque deja payee) : aucune depense, aucune ouverture de tour. */
    choiceKind: IntentChoice["kind"] | null;
  },
  record: ResolvedTurnRecord
): Promise<TurnOutcome> {
  const ctx = await resolveCharacterActionContext(supabase, params.entityId, params.campaignId, params.locale);
  if (!ctx) throw new Error(`Entite introuvable pour appliquer un tour deja resolu : ${params.entityId}`);

  // 1. Le tour s'ouvre : budget neuf, et la depense de CETTE action — sauf
  //    resolution chainee, qui poursuit le tour deja ouvert par l'attaque.
  const sceneBefore = await getSceneState(supabase, params.campaignId);
  let scene = sceneBefore ? (params.choiceKind === null ? sceneBefore : startTurn(sceneBefore, params.entityId, ctx.sheet.speed.value)) : null;

  // 2. Ce que ce fait reveille. Les tests et sauvegardes ont deja fait
  //    partir les leurs (`checkRolls`), qui nous les rend desormais ; une
  //    ATTAQUE, elle, n'avait aucun appelant avant ce ticket — il lui
  //    manquait la CA de la cible, que la barre d'intention fournit enfin.
  const effects: ResolvedEffect[] = [];
  // Le champ stocke s'appelle `critical`, jamais `isCritical` — c'est le nom
  // que `payload.attack` porte reellement (turnIntent.ts, executeIntent ET
  // resolveIntentRequest). Corrige ici (defaut trouve en ecrivant V3-B5) :
  // l'ancien cast lisait `isCritical`, un champ absent du payload reel — un
  // critique n'a donc jamais declenche `eventsForAttack` correctement.
  const attackDetail = record.detail.attack as { total: number; critical: boolean } | undefined;
  const attack: Pick<AttackRollResult, "total" | "isCritical"> | undefined = attackDetail
    ? { total: attackDetail.total, isCritical: attackDetail.critical }
    : undefined;
  const targetId = (record.detail.intent as { target_id?: string | null } | undefined)?.target_id ?? null;
  const ac = record.detail.ac as number | null | undefined;
  const damage = record.detail.damage as { total: number } | null | undefined;

  // Les degats d'un coup porte sont le premier effet du tour, et le plus
  // simple : ils ne viennent d'aucun declencheur, ils viennent du coup.
  // C'est precisement ce que B1 avait laisse de cote (« appliquer est
  // V3-B2 ») et l'exemple que le ticket dessine — « Gobelin 2 : 7 → −1 PV ».
  if (damage && targetId) {
    effects.push({ action: "deal_damage", who: targetId, amount: damage.total });
  }
  effects.push(...record.effects);

  if (attack && typeof ac === "number" && targetId) {
    // Les trois faces de l'echange partent, pas seulement la premiere :
    // `attack_hit` pour l'attaquant, `damage_dealt` et `damage_taken` pour
    // chacun des deux. Une regle peut s'accrocher a n'importe laquelle.
    const fired = eventsForAttack({
      attacker: params.entityId,
      target: targetId,
      // `eventsForAttack` ne lit que `total` et `isCritical` du jet ; le
      // reste (trace, AST) n'a pas traverse le journal, et n'a pas a l'etre.
      result: attack as AttackRollResult,
      ac,
      damage: damage?.total,
    });
    const runtime = await getEntityRuntimeState(supabase, params.entityId, params.campaignId);
    for (const event of fired) {
      try {
        const out = await fireTriggersForCharacter(supabase, {
          rulesetId: ctx.rulesetId,
          subject: params.entityId,
          sheet: ctx.sheet,
          runtime,
          event,
          scene: scene ?? undefined,
        });
        effects.push(...out.effects);
      } catch (err) {
        // Une regle maison cassee n'emporte jamais un tour : le jet est
        // acquis. L'echec est CONSIGNE, jamais tu (CLAUDE.md).
        effects.push({
          action: "narrate_hint",
          text: `Règle non évaluée sur « ${event.event} » : ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }
  }

  // 3. L'application. Le noyau pur decide, ce service persiste.
  // Le combat de la scene s'il y en a un, sinon celui qui tourne dans la
  // campagne — meme source que les cibles de la barre d'intention (B1),
  // jamais une seconde definition de « qui est en face ».
  const combatId =
    scene?.activeCombatId ??
    (await listCombatsForCampaign(supabase, params.campaignId)).find((c) => c.status === "running")?.id ??
    null;
  const participants = combatId ? await listCombatParticipants(supabase, combatId) : [];

  const actors: Record<string, TurnActor> = {
    [params.entityId]: await loadActor(supabase, {
      campaignId: params.campaignId,
      entityId: params.entityId,
      hpMax: ctx.sheet.hitPoints.max,
      budgetSpeed: ctx.sheet.speed.value,
      scene,
    }),
  };
  const names: Record<string, string> = { [params.entityId]: ctx.entityName };
  for (const p of participants) {
    const key = `participant:${p.id}`;
    actors[key] = {
      hp: { current: p.hp_current ?? 0, max: p.hp_max ?? p.hp_current ?? 0, temp: p.temp_hp },
      conditions: Array.isArray(p.conditions) ? p.conditions.filter((c): c is string => typeof c === "string") : [],
      resources: {},
      budget: { action: 1, bonus: 1, reaction: 1, movement: 9, free: 1 },
    };
    names[key] = p.label;
  }

  // La depense du tour est un effet comme un autre : elle passe par le
  // meme chemin, donc elle se lit dans le meme journal. Une resolution
  // chainee (`choiceKind: null`) ne depense rien : l'action a deja ete
  // payee par l'attaque qui l'a declenchee.
  if (params.choiceKind !== null) {
    const spend = spendFromBudget(actors[params.entityId].budget, BUDGET_COST[params.choiceKind]);
    actors[params.entityId] = { ...actors[params.entityId], budget: spend.budget };
  }

  const applied = applyEffects({ scene: scene ?? emptySceneFor(sceneBefore), actors }, effects);

  // 4. La persistance, cible par cible. Un participant de combat passe par
  //    `patchCombatParticipant` — qui ecrit AUSSI l'etat de jeu quand la
  //    ligne porte une entite, et journalise l'ensemble en un evenement
  //    annulable d'un clic. Ne pas refaire ce travail a cote.
  const persisted: string[] = [];
  for (const [who, after] of Object.entries(applied.state.actors)) {
    const before = actors[who];
    const changedHp = before.hp.current !== after.hp.current || before.hp.temp !== after.hp.temp;
    const changedConditions = before.conditions.join("|") !== after.conditions.join("|");
    if (!changedHp && !changedConditions) continue;

    if (who.startsWith("participant:")) {
      const participantId = who.slice("participant:".length);
      const row = await getCombatParticipantById(supabase, participantId);
      if (!row) continue;
      await patchCombatParticipant(supabase, {
        participantId,
        patch: {
          ...(changedHp ? { hpCurrent: after.hp.current, tempHp: after.hp.temp } : {}),
          ...(changedConditions ? { conditions: after.conditions } : {}),
        },
        actorUserId: params.callerId,
        note: `Tour solo — ${params.text}`,
      });
      persisted.push(names[who] ?? participantId);
      continue;
    }

    await applyRuntimeStateChange(supabase, {
      entityId: who,
      campaignId: params.campaignId,
      patch: {
        ...(changedHp ? { hp: { current: after.hp.current, temp: after.hp.temp } } : {}),
        ...(changedConditions ? { conditions: after.conditions } : {}),
      },
      note: `Tour solo — ${params.text}`,
      sessionId: await getOrOpenSessionForCampaign(supabase, params.campaignId),
      actor: "player",
      actorUserId: params.callerId,
    });
    persisted.push(names[who] ?? who);
  }

  // 5. Ce que le tour a change, en clair, dans son propre evenement.
  const nameOf = (id: string) => names[id] ?? id;
  const changes = applied.changes.map((c) => describeChange(c, nameOf)).filter((line): line is string => line !== null);
  const ignored = applied.changes
    .filter((c): c is Extract<TurnChange, { kind: "ignored" }> => c.kind === "ignored")
    .map((c) => c.reason);
  const hints = applied.changes
    .filter((c): c is Extract<TurnChange, { kind: "hint" }> => c.kind === "hint")
    .map((c) => c.text);

  let applicationEventId: string | null = null;
  if (applied.changes.length > 0) {
    const sessionId = await getOrOpenSessionForCampaign(supabase, params.campaignId);
    const seq = await nextEventSeq(supabase, sessionId);
    const event = await insertSessionEvent(supabase, {
      sessionId,
      seq,
      kind: "rule_application",
      actor: "system",
      actorUserId: params.callerId,
      payload: {
        __v: 1,
        from_event: record.eventId,
        effects,
        changes: applied.changes,
        persisted,
        // V3-B4 — "raconter autrement" (reprendre un tour PASSE pour la
        // narration) doit retrouver les memes phrases que celles deja
        // montrees a l'ecran, sans re-resoudre `nameOf` : les noms
        // viennent de `names`, construit une seule fois par tour et
        // absent de ce payload — les recalculer depuis `changes`
        // (TurnChange bruts) demanderait de refaire cette resolution.
        // Ecrites une fois ici, elles se relisent telles quelles.
        changes_text: changes,
        hints_text: hints,
        // V3-D4 — meme raison, pour le fil : `ignored` etait rendu par
        // l'ecran mais jamais ecrit ici avant ce ticket, une regle non
        // appliquee redevenait invisible des le rechargement.
        ignored_text: ignored,
      } as unknown as Json,
    });
    applicationEventId = event.id;
  }

  // 6. La scene avance — l'heure, les zones que les effets ont changees,
  //    et les evenements recents. Ecrite en dernier : si tout ce qui
  //    precede a tenu, elle est le resume de ce tour.
  if (scene) {
    scene = { ...applied.state.scene, budgets: { ...applied.state.scene.budgets, [params.entityId]: applied.state.actors[params.entityId].budget } };
    // Meme raison que la depense ci-dessus : une resolution chainee ne fait
    // pas avancer l'horloge une seconde fois pour le meme coup.
    if (params.choiceKind !== null) {
      scene = { ...scene, time: advanceTime(scene.time, minutesForTurn(scene)) };
    }
    for (const id of [record.eventId, applicationEventId].filter((i): i is string => i !== null)) {
      scene = rememberEvent(scene, id);
    }
    await putSceneState(supabase, { campaignId: params.campaignId, state: scene, updatedBy: params.callerId });
  }

  return {
    record: { kind: record.kind, facts: record.facts, eventId: record.eventId, detail: record.detail },
    changes,
    hints,
    ignored,
    time: scene?.time ?? null,
    // Cette fonction n'appelle jamais de modele (turnIntent.noAi.test.ts le
    // verrouille) : la narration, si elle existe, est ajoutee par
    // l'appelant (app/api/solo/tour/route.ts), apres coup, jamais ici.
    narration: null,
  };
}

/**
 * Sans scene en base, le tour se joue quand meme : on en fabrique une, le
 * temps de l'appliquer, et on ne l'ecrit pas. Une regle qui deplace
 * quelqu'un n'aura alors rien a deplacer et le dira — c'est plus honnete
 * que de refuser de jouer parce que personne n'a encore choisi un lieu.
 */
function emptySceneFor(existing: SceneState | null): SceneState {
  return (
    existing ?? {
      __v: 2,
      locationId: "hors-scene",
      present: [],
      time: { day: 1, hour: 8, minute: 0 },
      lighting: "bright",
      activeCombatId: null,
      recentEvents: [],
      budgets: {},
    }
  );
}
