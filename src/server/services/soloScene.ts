import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { emptyScene, enterScene, leaveScene, type SceneState } from "@/src/core/rules/scene";
import { getSceneState, putSceneState } from "@/src/server/repos/sceneStates";
import { listCombatsForCampaign } from "@/src/server/repos/combats";
import { listEntitiesByIds, listEntitiesByKinds } from "@/src/server/repos/entities";
import type { SceneView } from "@/lib/solo/types";

type TypedClient = SupabaseClient<Database>;

/**
 * V3-B2 — Poser la scene, et la relire nommee.
 *
 * Le moteur tient la scene depuis V3-A4, mais **rien ne la creait** : aucun
 * ecran ne disait ou l'on est ni qui est la. Sans elle, une regle qui
 * deplace quelqu'un n'a personne a deplacer, le budget de tour n'a nulle
 * part ou se poser, et l'heure n'avance jamais. C'est le plus petit
 * necessaire pour que la boucle de tour ait un monde autour d'elle.
 *
 * Volontairement manuel. Le lot C fera entrer et sortir les PNJ tout seul,
 * depuis les generateurs et le wiki ; ici c'est le joueur qui le dit, ce
 * qui suffit a jouer et n'engage rien de ce que le lot C decidera.
 */

const PRESENCE_KINDS = ["character", "npc", "creature", "monster"] as const;

/** Les lieux et les presents possibles d'un monde, pour les deux listes de l'ecran. */
export async function listSceneChoices(
  supabase: TypedClient,
  worldId: string
): Promise<{ locations: { id: string; name: string }[]; candidates: { id: string; name: string }[] }> {
  const [locations, candidates] = await Promise.all([
    listEntitiesByKinds(supabase, worldId, ["location"]),
    listEntitiesByKinds(supabase, worldId, PRESENCE_KINDS),
  ]);
  return {
    locations: locations.map((e) => ({ id: e.id, name: e.name })),
    candidates: candidates.map((e) => ({ id: e.id, name: e.name })),
  };
}

/** La scene courante, ses identifiants resolus en noms — `null` si la campagne n'en a pas encore. */
export async function loadSceneView(supabase: TypedClient, campaignId: string): Promise<SceneView | null> {
  const scene = await getSceneState(supabase, campaignId);
  if (!scene) return null;

  const ids = [scene.locationId, ...scene.present.map((p) => p.entityId)];
  const byId = new Map((await listEntitiesByIds(supabase, ids)).map((e) => [e.id, e.name]));

  return {
    locationId: scene.locationId,
    locationName: byId.get(scene.locationId) ?? "Lieu inconnu",
    time: scene.time,
    lighting: scene.lighting,
    inCombat: scene.activeCombatId !== null,
    present: scene.present.map((p) => ({
      entityId: p.entityId,
      name: byId.get(p.entityId) ?? p.entityId,
      zone: p.zone,
    })),
  };
}

/**
 * Pose ou deplace la scene.
 *
 * L'heure, les budgets et les evenements recents d'une scene existante sont
 * CONSERVES : changer de lieu est un deplacement dans la partie, pas un
 * redemarrage. Seule une campagne qui n'avait pas de scene en recoit une
 * neuve, a huit heures du matin le premier jour.
 *
 * `activeCombatId` n'est pas un choix du joueur : il est relu du combat qui
 * tourne. Deux sources pour un meme fait donneraient un jour deux reponses.
 */
export async function setScene(
  supabase: TypedClient,
  params: { campaignId: string; locationId: string; present: string[]; callerId: string }
): Promise<SceneState> {
  const existing = await getSceneState(supabase, params.campaignId);
  let scene = existing ? { ...existing, locationId: params.locationId } : emptyScene(params.locationId);

  const wanted = new Set(params.present);
  for (const current of scene.present) {
    if (!wanted.has(current.entityId)) scene = leaveScene(scene, current.entityId);
  }
  for (const entityId of params.present) {
    scene = enterScene(scene, { entityId, zone: "near" });
  }

  const running = (await listCombatsForCampaign(supabase, params.campaignId)).find((c) => c.status === "running");
  scene = { ...scene, activeCombatId: running?.id ?? null };

  await putSceneState(supabase, { campaignId: params.campaignId, state: scene, updatedBy: params.callerId });
  return scene;
}
