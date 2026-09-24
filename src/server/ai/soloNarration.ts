import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import type { Viewer } from "@/src/core/visibility";
import { soloNarrationSchema, soloNarrationToolSchema } from "@/src/core/ai/soloNarrationProposal";
import { maxSimilarityToRecent } from "@/src/core/ai/narrationSimilarity";
import { buildSoloTurnContext } from "@/src/server/services/turnContext";
import { findEventByFromEvent, getSessionEventById, insertSessionEvent, nextEventSeq } from "@/src/server/repos/sessions";
import type { AiProvider } from "./provider";
import { runAiCompletion } from "./callAi";

type TypedClient = SupabaseClient<Database>;

const TOOL_NAME = "narrate_turn";

/**
 * V3-B4 — Au-dessus de ce seuil (Jaccard sur les mots, 0-1), une narration
 * est jugée trop proche d'une des dernières et vaut un second essai.
 * Choisi à l'œil plutôt que mesuré sur un corpus (« mesure simple » ne
 * demandait pas plus) : deux phrases qui partagent 60 % de leur
 * vocabulaire se lisent déjà comme une redite, en français comme ailleurs.
 */
const SIMILARITY_THRESHOLD = 0.6;

const SYSTEM_PROMPT =
  "Tu es le narrateur d'une session de jeu de role solo. Le moteur du jeu calcule deja tous les " +
  "resultats mecaniques (jets, degats, changements d'etat) : ils te sont donnes comme des FAITS deja " +
  "etablis, jamais a recalculer, jamais a re-narrer differemment. Ta seule tache : raconter ce tour en " +
  "deux a quatre phrases, en francais, en integrant les faits fournis sans les contredire. Si un PNJ " +
  "present reagit, utilise UNIQUEMENT un identifiant de PNJ fourni dans le contexte — n'en invente " +
  `jamais. Reponds toujours via l'outil ${TOOL_NAME}, une seule fois.`;

export interface SoloNarrationParams {
  worldId: string;
  campaignId: string;
  playerEntityId: string;
  /** Le viewer du joueur — jamais elevé, borne l'audience du contexte (V3-B3). */
  viewer: Viewer;
  userId: string;
  sessionId: string;
  /** L'événement `roll`/`player_action` que ce tour raconte — porté par `payload.from_event`, comme `rule_application` (V3-B2). */
  fromEventId: string;
  playerAction: string;
  facts: string[];
  changes: string[];
  hints: string[];
}

export interface SoloNarrationOutcome {
  ok: boolean;
  eventId?: string;
  narration?: string;
  npcReaction?: { npcId: string; text: string };
  invalidReason?: string;
  inputTokens: number;
  outputTokens: number;
}

interface NarrationAttempt {
  ok: boolean;
  narration?: string;
  npcReaction?: { npcId: string; text: string };
  invalidReason?: string;
  inputTokens: number;
  outputTokens: number;
}

/** Un seul aller-retour au modèle — jamais d'écriture en base ici, `narrateSoloTurn` décide seul lequel des essais garder. */
async function attemptNarration(
  supabase: TypedClient,
  provider: AiProvider,
  context: string,
  npcIds: string[],
  userId: string,
  campaignId: string
): Promise<NarrationAttempt> {
  const result = await runAiCompletion(
    supabase,
    provider,
    { userId, campaignId, purpose: "solo_turn" },
    {
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: context },
      ],
      tools: [{ name: TOOL_NAME, description: "Raconte ce tour de jeu solo", inputSchema: soloNarrationToolSchema(npcIds) }],
    }
  );

  const call = result.toolCalls.find((tc) => tc.name === TOOL_NAME);
  if (!call) {
    return { ok: false, invalidReason: "aucun appel d'outil", inputTokens: result.inputTokens, outputTokens: result.outputTokens };
  }

  const parsed = soloNarrationSchema(npcIds).safeParse(call.input);
  if (!parsed.success) {
    const reason = parsed.error.issues.map((i) => `${i.path.join(".") || "(racine)"} : ${i.message}`).join(" ; ");
    return { ok: false, invalidReason: reason, inputTokens: result.inputTokens, outputTokens: result.outputTokens };
  }

  return {
    ok: true,
    narration: parsed.data.narration,
    npcReaction: parsed.data.npc_reaction ? { npcId: parsed.data.npc_reaction.npc_id, text: parsed.data.npc_reaction.text } : undefined,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  };
}

/**
 * V3-B2 (câblage de la narration) — L'appel qui manquait : `playTurn`
 * (`turnLoop.ts`) construit les faits sans jamais appeler de modèle ; ce
 * fichier est le seul endroit qui le fait, APRÈS que la mécanique a déjà
 * tout tranché et journalisé.
 *
 * **Jamais essentiel.** Un tour est complet et journalisé avant que cette
 * fonction soit même appelée (`app/api/solo/tour/route.ts` l'appelle en
 * best-effort, après `playTurn`) — un échec ici (fournisseur injoignable,
 * sortie invalide, limite de débit) ne défait rien de ce que la mécanique
 * a déjà écrit. C'est `specs/cible-locale-et-ia.md` §4 appliqué au tour
 * solo : « aucune fonction essentielle ne doit dépendre du succès d'un
 * appel ».
 *
 * **Rejouable pour le même tour** (« raconter ce tour ») : cette fonction
 * ne relit ni ne relance aucun dé — `facts`/`changes`/`hints` viennent
 * TOUJOURS de l'appelant, jamais recalculés ici. Rejouer un tour, c'est
 * rappeler cette fonction avec les mêmes faits et le même `fromEventId` :
 * un nouvel événement `narration` de plus, jamais un nouveau jet.
 *
 * **V3-B4 — au-dessus du seuil de similarité, un seul nouvel essai, on
 * garde le meilleur.** Le contexte porte déjà la consigne de ne pas
 * répéter (`buildTurnContext`) ; ceci est le filet, pas le premier
 * rempart — un modèle local suit les consignes moins fidèlement qu'une
 * API (`specs/cible-locale-et-ia.md` §4). Si le premier essai est trop
 * proche d'une narration récente, UN second essai part avec le MÊME
 * contexte (la consigne y est déjà) ; celui des deux dont la similarité
 * maximale aux narrations récentes est la plus basse est retenu — jamais
 * les deux, un seul événement `narration` s'écrit.
 */
export async function narrateSoloTurn(supabase: TypedClient, provider: AiProvider, params: SoloNarrationParams): Promise<SoloNarrationOutcome> {
  const { text: context, npcIds, recentNarrations } = await buildSoloTurnContext(supabase, {
    worldId: params.worldId,
    campaignId: params.campaignId,
    playerEntityId: params.playerEntityId,
    viewer: params.viewer,
    sessionId: params.sessionId,
    playerAction: params.playerAction,
    facts: params.facts,
    changes: params.changes,
    hints: params.hints,
  });

  const first = await attemptNarration(supabase, provider, context, npcIds, params.userId, params.campaignId);
  if (!first.ok) return first;

  let chosen = first;
  if (recentNarrations.length > 0 && maxSimilarityToRecent(first.narration!, recentNarrations) > SIMILARITY_THRESHOLD) {
    const second = await attemptNarration(supabase, provider, context, npcIds, params.userId, params.campaignId);
    if (second.ok) {
      const firstScore = maxSimilarityToRecent(first.narration!, recentNarrations);
      const secondScore = maxSimilarityToRecent(second.narration!, recentNarrations);
      chosen = secondScore < firstScore ? second : first;
    }
    // Le second essai a echoue (sortie invalide, outil absent) : on garde
    // le premier, deja valide — une redite reste une narration, jamais
    // pire qu'un tour sans narration du tout.
  }

  const seq = await nextEventSeq(supabase, params.sessionId);
  const event = await insertSessionEvent(supabase, {
    sessionId: params.sessionId,
    seq,
    kind: "narration",
    actor: "ai",
    actorUserId: params.userId,
    payload: {
      __v: 1,
      from_event: params.fromEventId,
      text: chosen.narration,
      npc_reaction: chosen.npcReaction ? { npc_id: chosen.npcReaction.npcId, text: chosen.npcReaction.text } : null,
    } as unknown as Json,
  });

  return {
    ok: true,
    eventId: event.id,
    narration: chosen.narration,
    npcReaction: chosen.npcReaction,
    // Le cout de CHAQUE essai (garde ou non) est deja dans `ai_usage_log`,
    // un appel = une ligne, sans exception (regle absolue 13) — ce qui est
    // rendu ici decrit seulement l'essai retenu, jamais un total a
    // recalculer a la main.
    inputTokens: chosen.inputTokens,
    outputTokens: chosen.outputTokens,
  };
}

export type ReconstructTurnResult = { ok: true; playerAction: string; facts: string[]; changes: string[]; hints: string[] } | { ok: false; reason: string };

/**
 * V3-B4 — « raconter autrement » relit un tour DÉJÀ journalisé plutôt que
 * de le rejouer : jamais un dé relancé, jamais un fait recalculé. Le bouton
 * lui-même n'a pas encore d'écran où vivre (le fil, V3-D4, n'existe pas) —
 * cette fonction est prête pour lui, même motif que `buildSoloTurnContext`
 * laissée prête pour un appelant à venir.
 *
 * L'action du joueur n'est PAS dans `payload.facts` d'un `player_action`
 * (elle EST le fait, la phrase entière) ; pour un `roll`, elle se retrouve
 * en tête de `intent.text` — les deux formes déjà écrites par
 * `turnIntent.ts`, jamais redevinées ici.
 */
export async function reconstructTurnForNarration(supabase: TypedClient, sessionId: string, fromEventId: string): Promise<ReconstructTurnResult> {
  const rollOrAction = await getSessionEventById(supabase, fromEventId);
  if (!rollOrAction || (rollOrAction.kind !== "roll" && rollOrAction.kind !== "player_action")) {
    return { ok: false, reason: "tour introuvable ou pas un roll/player_action" };
  }
  const payload = rollOrAction.payload as { facts?: unknown; intent?: { text?: unknown } } | null;
  const facts = Array.isArray(payload?.facts) ? payload!.facts.filter((f): f is string => typeof f === "string") : [];
  const playerAction = typeof payload?.intent?.text === "string" ? payload.intent.text : (facts[0] ?? "");

  const application = await findEventByFromEvent(supabase, sessionId, "rule_application", fromEventId);
  const applicationPayload = application?.payload as { changes_text?: unknown; hints_text?: unknown } | null;
  const changes = Array.isArray(applicationPayload?.changes_text) ? applicationPayload!.changes_text.filter((c): c is string => typeof c === "string") : [];
  const hints = Array.isArray(applicationPayload?.hints_text) ? applicationPayload!.hints_text.filter((h): h is string => typeof h === "string") : [];

  return { ok: true, playerAction, facts, changes, hints };
}
