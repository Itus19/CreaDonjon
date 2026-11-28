import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import type { Viewer } from "@/src/core/visibility";
import { soloNarrationSchema, soloNarrationToolSchema } from "@/src/core/ai/soloNarrationProposal";
import { maxSimilarityToRecent } from "@/src/core/ai/narrationSimilarity";
import { soloSystemPrompt } from "@/src/core/ai/narrationPrompt";
import { esquissesDeLEchange } from "@/src/core/ai/npcAddressed";
import { parseTableSettings } from "@/src/core/campaigns/tableSettings";
import { getCampaignTableSettingsRaw } from "@/src/server/repos/campaigns";
import { buildSoloTurnContext } from "@/src/server/services/turnContext";
import { drawPriceListForScene } from "@/src/server/services/priceListDraw";
import { demandeLaCarte } from "@/src/core/rules/demandeCarte";
import { drawSketchForScene, recordSketchSpeechAndMaybeAnchor } from "@/src/server/services/sceneSketches";
import { proposeWorldNote } from "@/src/server/services/soloWorldNotes";
import { revelerNomsDits } from "@/src/server/services/nomPourLaTable";
import { advanceSceneAfterNarration, applyRoomAfterNarration, moveSceneAfterNarration } from "@/src/server/services/narrationScene";
import type { ElapsedProposal } from "@/src/core/rules/elapsed";
import type { GameTime } from "@/src/core/rules/scene";
import type { SceneView } from "@/lib/solo/types";
import { loadSceneView } from "@/src/server/services/soloScene";
import { findEventByFromEvent, getSessionEventById, insertSessionEvent, nextEventSeq } from "@/src/server/repos/sessions";
import { buildViewerForWorld } from "@/src/server/services/visibility";
import { getOrOpenSessionForCampaign } from "@/src/server/services/sessions";
import { resolveProviderForUser } from "./resolveProvider";
import type { RaisonSansNarration } from "@/src/core/ai/providerError";
import { AiProviderError, type AiProvider } from "./provider";
import { AiRateLimitError, runAiCompletion } from "./callAi";
import type { WorldNoteAspect } from "@/src/core/ai/npcPortrait";
import { addNarratedItem } from "@/src/server/services/narratedItems";
import { jouerJetDePnj } from "@/src/server/services/npcChecks";
import type { CheckTier } from "@/src/core/rules/checkDifficulty";
import type { NpcCheckAction } from "@/src/core/rules/npcRolls";

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

/**
 * Narration solo — la consigne vit dans `src/core/ai/narrationPrompt.ts`
 * (fonction pure, testée), réglée par le « Récit » de la partie (V3.2-5).
 */

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
  /** V3.2-52 — faux pour « raconter autrement » : un tour déjà joué ne relance jamais le dé d'un PNJ. */
  npcCheckAllowed?: boolean;
}

export interface SoloNarrationOutcome {
  ok: boolean;
  eventId?: string;
  narration?: string;
  npcReaction?: { npcId: string; text: string };
  /** V3.2-18 — la nouvelle heure quand la narration a fait passer du temps (durée proposée ou temps de parole) ; absente sinon. */
  time?: GameTime;
  /** V3.2-19 — la nouvelle scène quand la narration l'a déplacée : l'écran la pose sans la redemander. */
  scene?: SceneView;
  invalidReason?: string;
  inputTokens: number;
  outputTokens: number;
}

interface NarrationAttempt {
  ok: boolean;
  narration?: string;
  npcReaction?: { npcId: string; text: string };
  /** V3-C2 — un role demande, jamais un nom : `narrateSoloTurn` seul decide d'en tirer une esquisse. */
  newCharacterRequest?: { role: string };
  /** V3-C3 — une suggestion redactionnelle, jamais ecrite directement (`proposeWorldNote`). */
  worldNote?: { entityId: string; text: string; aspect?: WorldNoteAspect };
  npcItem?: { npcId: string; name: string };
  /** V3.2-52 — une tentative de PNJ dans la liste fermée ; `jouerJetDePnj` lance le dé. */
  npcCheck?: { npcId: string; action: NpcCheckAction; tier: CheckTier };
  /** V3.2-18 — une durée proposée, jamais appliquée telle quelle : `advanceSceneAfterNarration` la borne. */
  elapsed?: ElapsedProposal;
  /** V3.2-19 — un déplacement proposé vers un lieu voisin fourni ; `moveSceneAfterNarration` l'applique. */
  moveTo?: { locationId: string; with: string[] };
  /** V3.2-19 — une pièce proposée ; `applyRoomAfterNarration` la tranche. */
  enterRoom?: { name: string; description?: string };
  /** V3.2-28 — ceux qui changent de pièce avec le personnage. */
  roomWith?: string[];
  leaveRoom?: boolean;
  invalidReason?: string;
  inputTokens: number;
  outputTokens: number;
}

/** Un seul aller-retour au modèle — jamais d'écriture en base ici, `narrateSoloTurn` décide seul lequel des essais garder. */
async function attemptNarration(
  supabase: TypedClient,
  provider: AiProvider,
  systemPrompt: string,
  context: string,
  npcIds: string[],
  knownEntityIds: string[],
  moveTargetIds: string[],
  userId: string,
  campaignId: string
): Promise<NarrationAttempt> {
  const result = await runAiCompletion(
    supabase,
    provider,
    { userId, campaignId, purpose: "solo_turn" },
    {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: context },
      ],
      tools: [{ name: TOOL_NAME, description: "Raconte ce tour de jeu solo", inputSchema: soloNarrationToolSchema(npcIds, knownEntityIds, moveTargetIds) }],
    }
  );

  const call = result.toolCalls.find((tc) => tc.name === TOOL_NAME);
  if (!call) {
    return { ok: false, invalidReason: "aucun appel d'outil", inputTokens: result.inputTokens, outputTokens: result.outputTokens };
  }

  const parsed = soloNarrationSchema(npcIds, knownEntityIds, moveTargetIds).safeParse(call.input);
  if (!parsed.success) {
    const reason = parsed.error.issues.map((i) => `${i.path.join(".") || "(racine)"} : ${i.message}`).join(" ; ");
    return { ok: false, invalidReason: reason, inputTokens: result.inputTokens, outputTokens: result.outputTokens };
  }

  return {
    ok: true,
    narration: parsed.data.narration,
    npcReaction: parsed.data.npc_reaction ? { npcId: parsed.data.npc_reaction.npc_id, text: parsed.data.npc_reaction.text } : undefined,
    newCharacterRequest: parsed.data.new_character ? { role: parsed.data.new_character.role } : undefined,
    worldNote: parsed.data.world_note
      ? { entityId: parsed.data.world_note.entity_id, text: parsed.data.world_note.text, ...(parsed.data.world_note.aspect ? { aspect: parsed.data.world_note.aspect } : {}) }
      : undefined,
    npcItem: parsed.data.npc_item ? { npcId: parsed.data.npc_item.npc_id, name: parsed.data.npc_item.name } : undefined,
    npcCheck: parsed.data.npc_check ? { npcId: parsed.data.npc_check.npc_id, action: parsed.data.npc_check.action, tier: parsed.data.npc_check.tier } : undefined,
    elapsed: parsed.data.elapsed,
    moveTo: parsed.data.move_to ? { locationId: parsed.data.move_to.location_id, with: parsed.data.move_to.with ?? [] } : undefined,
    enterRoom: parsed.data.enter_room,
    roomWith: parsed.data.room_with ?? [],
    leaveRoom: parsed.data.leave_room ?? false,
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
/**
 * V3.2-42 — la carte se tire dès que le joueur demande à manger, à boire, une
 * chambre ou un prix dans un lieu qui n'en a pas : le moteur la tire (tables
 * du générateur Taverne, prix selon la richesse du lieu) et l'écrit sur la
 * page du lieu AVANT le contexte, pour que le PNJ cite de vrais prix.
 * Best-effort : un monde sans tables, ou sans droit d'écrire sur la page,
 * laisse le tour se raconter sans carte (la consigne interdit alors tout prix).
 * Coût : rien si la phrase ne demande rien ; sinon quatre lectures, et le
 * tirage une seule fois par lieu (`drawPriceListForScene`).
 */
async function tirerCarteSiDemandee(supabase: TypedClient, params: SoloNarrationParams): Promise<void> {
  if (!demandeLaCarte(params.playerAction)) return;
  try {
    // La narration solo est en français (consigne, lexiques) : la carte aussi.
    const tirage = await drawPriceListForScene(supabase, { campaignId: params.campaignId, worldId: params.worldId, userId: params.userId, locale: "fr" });
    if ("error" in tirage) console.error("Carte du lieu non tirée avant la narration", params.campaignId, tirage.error);
  } catch (erreur) {
    // Le tour se raconte quand même, sans carte.
    console.error("Tirage de la carte du lieu impossible", erreur);
  }
}

export async function narrateSoloTurn(supabase: TypedClient, provider: AiProvider, params: SoloNarrationParams): Promise<SoloNarrationOutcome> {
  await tirerCarteSiDemandee(supabase, params);
  // V3.2-5 : le réglage « Récit » (une lecture de la ligne de campagne, en parallèle du contexte).
  const [firstContext, rawSettings] = await Promise.all([
    buildSoloTurnContext(supabase, {
      worldId: params.worldId,
      campaignId: params.campaignId,
      playerEntityId: params.playerEntityId,
      viewer: params.viewer,
      sessionId: params.sessionId,
      playerAction: params.playerAction,
      fromEventId: params.fromEventId,
      facts: params.facts,
      changes: params.changes,
      hints: params.hints,
    }),
    getCampaignTableSettingsRaw(supabase, params.campaignId),
  ]);
  const systemPrompt = soloSystemPrompt(parseTableSettings(rawSettings).recit, TOOL_NAME);

  const { text: context, npcIds, knownEntityIds, moveTargetIds, recentNarrations, addressedNpcId, addressedIsQuestion, npcs } = firstContext;
  const first = await attemptNarration(supabase, provider, systemPrompt, context, npcIds, knownEntityIds, moveTargetIds, params.userId, params.campaignId);
  if (!first.ok) return first;

  let chosen = first;
  // Les présents vus par l'essai retenu : le second essai d'un nouveau
  // personnage voit une esquisse de plus, absente de `npcs`.
  let chosenNpcs = npcs;
  if (first.newCharacterRequest) {
    // V3-C2 — jamais le modele qui invente un nom : le generateur tire une
    // esquisse (dés réels, journalisée), et SEULEMENT ALORS un second essai
    // raconte avec l'identite reellement tiree. Un tirage impossible (aucun
    // outil MJ dans ce monde, par exemple) laisse `first` tel quel — le
    // personnage incident reste alors hors scene plutot que de bloquer le tour.
    const drawn = await drawSketchForScene(supabase, {
      campaignId: params.campaignId,
      worldId: params.worldId,
      sessionId: params.sessionId,
      callerId: params.userId,
    });
    if (drawn.ok) {
      const retry = await buildSoloTurnContext(supabase, {
        worldId: params.worldId,
        campaignId: params.campaignId,
        playerEntityId: params.playerEntityId,
        viewer: params.viewer,
        sessionId: params.sessionId,
        playerAction: params.playerAction,
        fromEventId: params.fromEventId,
        facts: params.facts,
        changes: params.changes,
        hints: params.hints,
      });
      const second = await attemptNarration(supabase, provider, systemPrompt, retry.text, retry.npcIds, retry.knownEntityIds, retry.moveTargetIds, params.userId, params.campaignId);
      if (second.ok) {
        chosen = second;
        chosenNpcs = retry.npcs;
      }
    }
  } else if (addressedNpcId && addressedIsQuestion && first.npcReaction?.npcId !== addressedNpcId) {
    // Le joueur a posé une QUESTION à un PNJ désigné par le code
    // (`npcAddressedBy`, `estQuestionDirecte`) et le modèle ne l'a pas fait
    // répondre : UN second essai, même contexte (la consigne y est déjà). On
    // garde celui où ce PNJ répond ; sinon le premier, déjà valide. Sans
    // question, le silence du PNJ est un choix légitime du narrateur : pas
    // de second essai (V3.2-17).
    const second = await attemptNarration(supabase, provider, systemPrompt, context, npcIds, knownEntityIds, moveTargetIds, params.userId, params.campaignId);
    if (second.ok && second.npcReaction?.npcId === addressedNpcId) chosen = second;
  } else if (recentNarrations.length > 0 && maxSimilarityToRecent(first.narration!, recentNarrations) > SIMILARITY_THRESHOLD) {
    const second = await attemptNarration(supabase, provider, systemPrompt, context, npcIds, knownEntityIds, moveTargetIds, params.userId, params.campaignId);
    if (second.ok) {
      const firstScore = maxSimilarityToRecent(first.narration!, recentNarrations);
      const secondScore = maxSimilarityToRecent(second.narration!, recentNarrations);
      chosen = secondScore < firstScore ? second : first;
    }
    // Le second essai a echoue (sortie invalide, outil absent) : on garde
    // le premier, deja valide — une redite reste une narration, jamais
    // pire qu'un tour sans narration du tout.
  }

  // Le nom et l'attitude du PNJ qui parle, figés au moment de la réplique :
  // le fil les affiche sous la bulle sans relire la scène, et un journal
  // garde ce qui était vrai à ce moment-là (l'attitude peut changer ensuite).
  // Le nom est celui que le JOUEUR connaît (`known_as`), jamais un secret.
  const speaker = chosen.npcReaction ? chosenNpcs.find((n) => n.id === chosen.npcReaction!.npcId) : undefined;

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
      npc_reaction: chosen.npcReaction
        ? {
            npc_id: chosen.npcReaction.npcId,
            text: chosen.npcReaction.text,
            npc_name: speaker?.name ?? null,
            npc_attitude: speaker?.attitudeLabel ?? null,
          }
        : null,
    } as unknown as Json,
  });

  // V3-C2, V3.2-44 — chaque esquisse avec qui ce tour a été un échange
  // (réplique, ou servie sans un mot quand le joueur s'adresse à quelqu'un)
  // avance son compteur d'ancrage. Best-effort, APRÈS que la narration est
  // déjà journalisée : un échec ici ne doit jamais faire disparaître une
  // narration réussie. Un id de vrai PNJ est ignoré
  // (`recordSketchSpeechAndMaybeAnchor` ne touche qu'aux esquisses).
  const echanges = esquissesDeLEchange({
    playerAction: params.playerAction,
    narration: chosen.narration ?? "",
    reactionNpcId: chosen.npcReaction?.npcId ?? null,
    esquisses: chosenNpcs,
  });
  for (const sketchId of echanges) {
    try {
      await recordSketchSpeechAndMaybeAnchor(supabase, {
        campaignId: params.campaignId,
        worldId: params.worldId,
        sessionId: params.sessionId,
        sketchId,
        callerId: params.userId,
      });
    } catch (erreur) {
      // Journalisé, pas propagé : la narration ci-dessus est déjà acquise.
      console.error("Mémorisation de l'échange avec l'esquisse impossible", erreur);
    }
  }

  // V3.2-45 — la narration a dit le vrai nom d'un présent connu par son seul
  // libellé : le personnage l'apprend. Même discipline best-effort.
  if (firstContext.trueNames.length > 0) {
    const texte = [chosen.narration ?? "", chosen.npcReaction?.text ?? ""].join("\n");
    try {
      await revelerNomsDits(supabase, { texte, trueNames: firstContext.trueNames, userId: params.userId });
    } catch (erreur) {
      console.error("Révélation d'un vrai nom impossible", erreur);
    }
  }

  if (chosen.worldNote) {
    // V3-C3, V3.2-27 — même discipline best-effort : une note du monde
    // n'est jamais essentielle (specs/cible-locale-et-ia.md §4), la
    // narration reste acquise même si `ai_proposals` échoue à l'écrire.
    try {
      await proposeWorldNote(supabase, {
        worldId: params.worldId,
        campaignId: params.campaignId,
        sessionId: params.sessionId,
        sessionEventId: event.id,
        entityId: chosen.worldNote.entityId,
        text: chosen.worldNote.text,
        ...(chosen.worldNote.aspect ? { aspect: chosen.worldNote.aspect } : {}),
        callerId: params.userId,
      });
    } catch (erreur) {
      // Ignoré volontairement : la narration ci-dessus est déjà acquise.
      console.error("Proposition de note de monde impossible", erreur);
    }
  }

  if (chosen.npcItem) {
    // V3.2-54 — un objet montré par la narration entre dans l'inventaire du PNJ ; même discipline best-effort.
    try {
      const added = await addNarratedItem(supabase, {
        worldId: params.worldId,
        campaignId: params.campaignId,
        sessionEventId: event.id,
        entityId: chosen.npcItem.npcId,
        name: chosen.npcItem.name,
        callerId: params.userId,
      });
      if (!added.ok && added.reason !== "refused" && added.reason !== "no_inventory") console.warn(`Objet du récit non ajouté (${added.reason})`);
    } catch (erreur) {
      // Ignoré volontairement : la narration ci-dessus est déjà acquise.
      console.error("Objet du récit impossible à ajouter", erreur);
    }
  }

  if (chosen.npcCheck && params.npcCheckAllowed !== false) {
    // V3.2-52 — le PNJ a tenté quelque chose : le moteur lance son dé, la narration suivante racontera l'issue. Best-effort.
    try {
      await jouerJetDePnj(supabase, {
        worldId: params.worldId,
        sessionId: params.sessionId,
        npcId: chosen.npcCheck.npcId,
        action: chosen.npcCheck.action,
        tier: chosen.npcCheck.tier,
        callerId: params.userId,
      });
    } catch (erreur) {
      // Ignoré volontairement : la narration ci-dessus est déjà acquise.
      console.error("Jet du PNJ impossible", erreur);
    }
  }

  // V3.2-18 — le temps que ce tour a pris, APRÈS la narration : best-effort,
  // même discipline que ci-dessus. Le moteur borne la proposition ; une
  // durée écrite par le joueur a déjà été appliquée par `playTurn`.
  let time: GameTime | null = null;
  try {
    time = await advanceSceneAfterNarration(supabase, {
      campaignId: params.campaignId,
      callerId: params.userId,
      playerAction: params.playerAction,
      elapsed: chosen.elapsed ?? null,
      npcReplyText: chosen.npcReaction?.text ?? null,
    });
  } catch (erreur) {
    // Ignoré volontairement : la narration ci-dessus est déjà acquise.
    console.error("Avance de l'horloge après la narration impossible", erreur);
  }

  // V3.2-19 — le déplacement proposé, APRÈS l'horloge : `setScene` relit la
  // scène, l'heure avancée ci-dessus est donc conservée. Best-effort.
  let scene: SceneView | null = null;
  if (chosen.moveTo) {
    try {
      const moved = await moveSceneAfterNarration(supabase, {
        campaignId: params.campaignId,
        worldId: params.worldId,
        callerId: params.userId,
        playerEntityId: params.playerEntityId,
        locationId: chosen.moveTo.locationId,
        followers: chosen.moveTo.with,
      });
      if (moved) scene = await loadSceneView(supabase, { campaignId: params.campaignId, worldId: params.worldId });
    } catch (erreur) {
      // Ignoré volontairement : la narration ci-dessus est déjà acquise.
      console.error("Déplacement de la scène après la narration impossible", erreur);
    }
  }

  // V3.2-19 — la pièce proposée, seulement si la scène n'a pas changé de
  // lieu : un déplacement l'emporte, et laisse les pièces derrière.
  if (!chosen.moveTo && (chosen.enterRoom || chosen.leaveRoom || firstContext.inSketchRoom) && firstContext.locationName) {
    try {
      const roomChanged = await applyRoomAfterNarration(supabase, {
        worldId: params.worldId,
        campaignId: params.campaignId,
        callerId: params.userId,
        viewer: params.viewer,
        sessionEventId: event.id,
        playerAction: params.playerAction,
        enter: chosen.enterRoom,
        leave: chosen.leaveRoom ?? false,
        playerEntityId: params.playerEntityId,
        followers: chosen.roomWith ?? [],
        wikiRooms: firstContext.wikiRooms,
        locationName: firstContext.locationName,
        neighbourNames: firstContext.moveTargets.map((l) => l.name),
      });
      if (roomChanged) scene = await loadSceneView(supabase, { campaignId: params.campaignId, worldId: params.worldId });
    } catch (erreur) {
      // Ignoré volontairement : la narration ci-dessus est déjà acquise.
      console.error("Pièce proposée par la narration impossible à poser", erreur);
    }
  }

  return {
    ok: true,
    eventId: event.id,
    narration: chosen.narration,
    npcReaction: chosen.npcReaction,
    ...(time ? { time } : {}),
    ...(scene ? { scene } : {}),
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

/**
 * V3.1-223 — pourquoi la narration n'a pas abouti, pour l'écran. Le corps
 * d'erreur complet reste dans la console du serveur ; l'écran n'en reçoit que
 * la phrase utile (`detailSansNarration`).
 */
export function raisonSansNarration(erreur: unknown): RaisonSansNarration {
  if (erreur instanceof AiProviderError) return erreur.raison;
  if (erreur instanceof AiRateLimitError) return "limite_app";
  return "echec";
}

/** La phrase du fournisseur quand il a refusé l'appel ; rien pour les autres causes. */
export function detailSansNarration(erreur: unknown): string | undefined {
  return erreur instanceof AiProviderError ? erreur.detail : undefined;
}

export type NarrationDuTour =
  | { ok: true; text: string; npcReaction: { npcId: string; text: string } | null; time: GameTime | null; scene: SceneView | null }
  | { ok: false; raison: RaisonSansNarration; detail?: string };

/**
 * V3.1-216 — la narration d'un tour solo, telle que les routes l'appellent :
 * toujours APRÈS que le tour est écrit, toujours best-effort (specs/
 * cible-locale-et-ia.md §4 : aucune fonction essentielle ne dépend du succès
 * d'un appel de modèle). Un échec, un fournisseur absent : le tour reste
 * joué, et la raison remonte à l'écran (V3.1-223), jamais une erreur.
 *
 * Elle existe parce qu'un quatrième chemin la demande (le tour repris après
 * une fenêtre de réaction) : quatre copies du même bloc `try` dans quatre
 * routes valaient une fonction.
 */
export async function narrerTourSoloSansFaillir(
  supabase: TypedClient,
  params: Omit<SoloNarrationParams, "viewer" | "sessionId">,
): Promise<NarrationDuTour> {
  try {
    // V3.1-224 (ADR 0103) : le fournisseur du COMPTE qui joue, sinon celui de
    // l'environnement, sinon aucun — et le tour reste joué, muet (V3.1-223).
    const provider = await resolveProviderForUser(supabase, params.userId);
    if (!provider) return { ok: false, raison: "aucun_fournisseur" };
    const [viewer, sessionId] = await Promise.all([
      buildViewerForWorld(supabase, params.worldId, params.userId),
      getOrOpenSessionForCampaign(supabase, params.campaignId),
    ]);
    const narrated = await narrateSoloTurn(supabase, provider, { ...params, viewer, sessionId });
    return narrated.ok && narrated.narration
      ? { ok: true, text: narrated.narration, npcReaction: narrated.npcReaction ?? null, time: narrated.time ?? null, scene: narrated.scene ?? null }
      : { ok: false, raison: "inutilisable" };
  } catch (erreur) {
    console.error("Narration du tour impossible", erreur);
    return { ok: false, raison: raisonSansNarration(erreur), detail: detailSansNarration(erreur) };
  }
}
