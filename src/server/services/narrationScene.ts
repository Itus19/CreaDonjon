import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { advanceSceneTime, type GameTime } from "@/src/core/rules/scene";
import { compterMots, dureeExplicite, minutesDeParole, minutesProposees, type ElapsedProposal } from "@/src/core/rules/elapsed";
import { contientParole } from "@/src/core/ai/npcAddressed";
import { getSceneState, putSceneState } from "@/src/server/repos/sceneStates";
import { setScene } from "@/src/server/services/soloScene";
import type { Viewer } from "@/src/core/visibility";
import { ajouterPiece, deciderPiece, pieceAncree } from "@/src/core/rules/rooms";
import { zRoomsBlockData, DEFAULT_ROOMS_BLOCK_DATA, type Room } from "@/src/core/schemas/blocks/rooms";
import { listBlocksByTypesForEntities } from "@/src/server/repos/blocks";
import { filtrerBlocsVisibles, createBlockWithData, updateBlockContent } from "@/src/server/services/blocks";
import { insertAiProposal } from "@/src/server/repos/aiProposals";
import type { Json } from "@/src/types/database";

type TypedClient = SupabaseClient<Database>;

/** Ce que `playTurn` a déjà compté pour une action hors combat (`minutesForTurn`) : retiré pour ne pas compter deux fois. */
const MINUTES_DEJA_COMPTEES = 1;

/**
 * V3.2-18 (ADR 0112) — Le temps que la narration fait passer, APRÈS elle :
 * la durée proposée par l'IA (`elapsed`, liste fermée) ou le temps de
 * parole, la plus longue des deux, bornée par le moteur (`minutesProposees`).
 *
 * Rien quand le joueur a écrit une durée : `playTurn` l'a déjà appliquée
 * avant la narration, et elle l'emporte toujours sur une proposition de
 * l'IA. Rien en combat. Une lecture de la scène, une écriture seulement si
 * l'horloge bouge.
 *
 * Rend la nouvelle heure, ou `null` si rien n'a bougé. L'annulation du tour
 * (V3-F2) restaure la scène d'avant le tour : ce temps-là est défait avec
 * le reste.
 */
export async function advanceSceneAfterNarration(
  supabase: TypedClient,
  params: { campaignId: string; callerId: string; playerAction: string; elapsed: ElapsedProposal | null; npcReplyText: string | null }
): Promise<GameTime | null> {
  if (dureeExplicite(params.playerAction)) return null;
  const scene = await getSceneState(supabase, params.campaignId);
  if (!scene || scene.activeCombatId) return null;

  const proposees = params.elapsed ? minutesProposees(params.elapsed, scene.time, false) : 0;
  const parle = contientParole(params.playerAction) || params.npcReplyText !== null;
  const parole = parle ? minutesDeParole(compterMots(params.playerAction) + compterMots(params.npcReplyText ?? "")) : 0;
  const minutes = Math.max(proposees, parole) - MINUTES_DEJA_COMPTEES;
  if (minutes <= 0) return null;

  const next = advanceSceneTime(scene, minutes);
  await putSceneState(supabase, { campaignId: params.campaignId, state: next, updatedBy: params.callerId });
  return next.time;
}

/**
 * V3.2-19 — Le déplacement que la narration propose (`move_to`), appliqué
 * par la même fonction que le panneau de scène (`setScene` : découverte du
 * lieu, météo fraîche, esquisses laissées derrière). Le lieu a déjà été
 * borné par le schéma (un des `lieuxVoisins` visibles) ; ici, le moteur
 * garde le personnage joué et les PNJ RÉELS présents qui le suivent, jamais
 * une esquisse (elle ne survit pas à son lieu) ni un absent. Rien en combat.
 * Rend vrai si la scène a changé de lieu.
 */
export async function moveSceneAfterNarration(
  supabase: TypedClient,
  params: { campaignId: string; worldId: string; callerId: string; playerEntityId: string; locationId: string; followers: string[] }
): Promise<boolean> {
  const scene = await getSceneState(supabase, params.campaignId);
  if (!scene || scene.activeCombatId || scene.locationId === params.locationId) return false;
  const suivent = new Set([params.playerEntityId, ...params.followers]);
  const present = scene.present.map((p) => p.entityId).filter((id) => suivent.has(id));
  await setScene(supabase, { campaignId: params.campaignId, worldId: params.worldId, locationId: params.locationId, present, callerId: params.callerId });
  return true;
}

/**
 * V3.2-19 — La pièce que la narration propose (`enter_room`, `leave_room`),
 * tranchée par le moteur (`deciderPiece`) : une pièce du wiki, une esquisse
 * déjà vue, ou une pièce nouvelle qui passe le contrôle. Quand une esquisse
 * doit entrer dans le wiki (seconde visite, ou le joueur la nomme), elle
 * s'ajoute au bloc « Pièces » de la page du lieu, sans relecture humaine
 * (décision de l'auteur, 25 novembre 2026), avec une ligne `ai_proposals`
 * déjà appliquée pour la trace (règle absolue 9).
 *
 * L'écriture passe par les mêmes barrières qu'une modification à la main
 * (`updateBlockContent`, `createBlockWithData` : droit d'écriture sur la
 * page). Si la personne qui joue ne peut pas modifier la page du lieu, la
 * pièce reste une esquisse dans la scène : rien n'est perdu, rien n'est
 * forcé. Rien en combat. Rend vrai si la pièce courante a changé.
 */
export async function applyRoomAfterNarration(
  supabase: TypedClient,
  params: {
    worldId: string;
    campaignId: string;
    callerId: string;
    viewer: Viewer;
    sessionEventId: string;
    playerAction: string;
    enter: { name: string; description?: string } | undefined;
    leave: boolean;
    wikiRooms: Room[];
    locationName: string;
    neighbourNames: string[];
  }
): Promise<boolean> {
  const scene = await getSceneState(supabase, params.campaignId);
  if (!scene || scene.activeCombatId) return false;
  const decision = deciderPiece(scene, { enter: params.enter, leave: params.leave }, params);
  if (decision.refus) console.warn(`Pièce proposée refusée par le moteur (${decision.refus}) : ${params.enter?.name ?? ""}`);
  if (decision.scene === scene) return false;

  let next = decision.scene;
  if (decision.anchor && (await ancrerPiece(supabase, { ...params, locationId: scene.locationId, piece: decision.anchor }))) {
    next = pieceAncree(next, decision.anchor.name);
  }
  await putSceneState(supabase, { campaignId: params.campaignId, state: next, updatedBy: params.callerId });
  return decision.changed;
}

/** Ajoute la pièce au premier bloc « Pièces » que la personne voit sur la page du lieu, ou en crée un. Vrai si c'est écrit. */
async function ancrerPiece(
  supabase: TypedClient,
  params: { worldId: string; campaignId: string; callerId: string; viewer: Viewer; sessionEventId: string; locationId: string; piece: { name: string; description: string } }
): Promise<boolean> {
  const bloc = filtrerBlocsVisibles(await listBlocksByTypesForEntities(supabase, [params.locationId], ["rooms"]), params.viewer).sort((a, b) => a.display_order - b.display_order)[0];
  let ecrit = false;
  let blockId: string | null = null;
  if (bloc) {
    const lu = zRoomsBlockData.safeParse(bloc.data);
    if (!lu.success) return false;
    const saved = await updateBlockContent(supabase, {
      id: bloc.id,
      expectedVersion: bloc.version,
      display: bloc.display,
      data: ajouterPiece(lu.data, params.piece),
      visibilityLevel: bloc.visibility_level,
      visibilityScopeId: bloc.visibility_scope_id,
      changedBy: params.callerId,
      changeSource: "ai",
    });
    ecrit = saved.ok;
    blockId = bloc.id;
  } else {
    const created = await createBlockWithData(supabase, {
      entityId: params.locationId,
      blockType: "rooms",
      label: "Pièces",
      visibilityLevel: "players",
      visibilityScopeId: null,
      createdBy: params.callerId,
      data: ajouterPiece(DEFAULT_ROOMS_BLOCK_DATA, params.piece),
    });
    ecrit = created.ok;
  }
  if (!ecrit) return false;
  await insertAiProposal(supabase, {
    worldId: params.worldId,
    campaignId: params.campaignId,
    sessionEventId: params.sessionEventId,
    kind: blockId ? "update_block" : "create_block",
    targetEntityId: params.locationId,
    payload: { block_type: "rooms", block_id: blockId, room: params.piece } as unknown as Json,
    status: "applied",
    autoApplied: true,
    appliedAt: new Date().toISOString(),
  });
  return true;
}
