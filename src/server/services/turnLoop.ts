import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import type { Locale } from "@/src/i18n/request";
import { advanceSceneTime, rememberEvent, startTurn, type SceneState } from "@/src/core/rules/scene";
import type { BudgetKind } from "@/src/core/rules/actionBudget";
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
import { listCombatsForCampaign } from "@/src/server/repos/combats";
import { getSceneState, putSceneState } from "@/src/server/repos/sceneStates";
import type { TurnOutcome } from "@/lib/solo/types";
import { applyResolvedEffects, fireActorTriggers } from "@/src/server/services/targetedRoll";

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
    // V3.1-105 : le meme moteur que la table (`targetedRoll.ts`).
    effects.push(...(await fireActorTriggers(supabase, { ctx, actorEntityId: params.entityId, campaignId: params.campaignId, events: fired, scene })));
  }

  // 3 a 5. L'application, la persistance et son journal : le coeur commun
  // (V3.1-105, ADR 0042), partage avec la table. Le combat de la scene s'il
  // y en a un, sinon celui qui tourne dans la campagne — meme source que les
  // cibles de la barre d'intention (B1). Une resolution chainee
  // (`choiceKind: null`) ne depense rien : l'action a deja ete payee.
  const combatId =
    scene?.activeCombatId ??
    (await listCombatsForCampaign(supabase, params.campaignId)).find((c) => c.status === "running")?.id ??
    null;
  const { applied, changes, hints, ignored, applicationEventId } = await applyResolvedEffects(supabase, {
    campaignId: params.campaignId,
    callerId: params.callerId,
    actor: { entityId: params.entityId, name: ctx.entityName, hpMax: ctx.sheet.hitPoints.max, speed: ctx.sheet.speed.value },
    scene,
    spend: params.choiceKind !== null ? BUDGET_COST[params.choiceKind] : null,
    effects,
    note: `Tour solo — ${params.text}`,
    fromEventId: record.eventId,
    combatId,
  });

  // 6. La scene avance — l'heure, les zones que les effets ont changees,
  //    et les evenements recents. Ecrite en dernier : si tout ce qui
  //    precede a tenu, elle est le resume de ce tour.
  if (scene) {
    scene = { ...applied.state.scene, budgets: { ...applied.state.scene.budgets, [params.entityId]: applied.state.actors[params.entityId].budget } };
    // Meme raison que la depense ci-dessus : une resolution chainee ne fait
    // pas avancer l'horloge une seconde fois pour le meme coup.
    if (params.choiceKind !== null) {
      scene = advanceSceneTime(scene, minutesForTurn(scene));
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
