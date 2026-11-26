import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { dropRoomsOutsideLocation, dropSketchesOutsideLocation, emptyScene, enterScene, leaveScene, sceneCalendarDate, type SceneState } from "@/src/core/rules/scene";
import { formatGameDate } from "@/src/core/calendar/formatDate";
import { weekdayNameForDate } from "@/src/core/calendar/weekday";
import type { CalendarConfigInput } from "@/src/core/schemas/calendar";
import { getSceneState, putSceneState } from "@/src/server/repos/sceneStates";
import { listCombatsForCampaign } from "@/src/server/repos/combats";
import { listEntitiesByIds, listEntitiesByKinds } from "@/src/server/repos/entities";
import { listPartOfRelationsForWorld } from "@/src/server/repos/relations";
import { discoverEntity } from "@/src/server/services/discoveries";
import { listAttitudesTowardTarget } from "@/src/server/repos/psyche";
import { axesDepuisJson, perceptionPercue } from "@/src/core/psyche/perception";
import { generateForScene } from "@/src/server/services/sceneGeneration";
import { esquissesIci, oublierLesPieces, presentsIci, ramenerIci } from "@/src/core/rules/scenePresence";
import { poserLaVie } from "@/src/core/rules/sceneLife";
import { lireLaVieDuLieu } from "@/src/server/services/sceneLife";
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
const WEATHER_TOOL_KEY = "meteo";
const WEATHER_SECTION_KEY = "meteo-condition";

/**
 * V3-C6 — La condition tiree au generateur `meteo` (V3-C1, memes dés
 * reels), jamais une invention du modele. `null` sans table reelle a tirer
 * dans ce monde (aucun outil MJ, section vide) — omise plutot qu'inventee,
 * meme discipline que la date sans calendrier reglé (V3-D2).
 */
async function drawWeather(supabase: TypedClient, params: { campaignId: string; worldId: string; callerId: string }): Promise<string | null> {
  const drawn = await generateForScene(supabase, { campaignId: params.campaignId, worldId: params.worldId, toolKey: WEATHER_TOOL_KEY, callerId: params.callerId });
  if ("error" in drawn) return null;
  const condition = drawn.sections.find((s) => s.key === WEATHER_SECTION_KEY)?.text.trim();
  return condition || null;
}

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

/**
 * La scene courante, ses identifiants resolus en noms — `null` si la
 * campagne n'en a pas encore.
 *
 * `worldId` (V3-D2) : sert uniquement a retrouver le parent `part_of` du
 * lieu (la "ville la plus proche" de l'en-tete). Un aller-retour de plus
 * que l'ancienne version, accepte parce que cette fonction ne tourne pas a
 * chaque tour — seulement au chargement de l'ecran et quand la scene
 * change.
 *
 * `perceivedBy` (V3.2-14, ADR 0111) : l'entite jouee. Fournie, chaque
 * present porte l'attitude qu'il LAISSE VOIR envers elle, en bandes — une
 * requete groupee de plus. La valeur ressentie ne quitte jamais cette
 * fonction (regle absolue 5) : seul le resultat de `perceptionPercue` part.
 */
export async function loadSceneView(
  supabase: TypedClient,
  params: { campaignId: string; worldId: string; perceivedBy?: string }
): Promise<SceneView | null> {
  const scene = await getSceneState(supabase, params.campaignId);
  if (!scene) return null;

  const edges = await listPartOfRelationsForWorld(supabase, params.worldId);
  const nearestCityId = edges.find((e) => e.source_entity_id === scene.locationId)?.target_entity_id ?? null;

  // V3.2-28 : seulement ceux qui partagent la pièce du personnage.
  const ici = presentsIci(scene);
  const ids = [scene.locationId, ...ici.map((p) => p.entityId), ...(nearestCityId ? [nearestCityId] : [])];
  const presentIds = ici.map((p) => p.entityId);
  const [entities, attitudes] = await Promise.all([
    listEntitiesByIds(supabase, ids),
    params.perceivedBy
      ? listAttitudesTowardTarget(supabase, { campaignId: params.campaignId, sourceEntityIds: presentIds, targetEntityId: params.perceivedBy })
      : Promise.resolve([]),
  ]);
  const byId = new Map(entities.map((e) => [e.id, e]));
  // ADR 0111 : la facade l'emporte axe par axe ; sans elle, le percu est le ressenti.
  const perceptionById = new Map(attitudes.map((a) => [a.source_entity_id, perceptionPercue(axesDepuisJson(a.axes), axesDepuisJson(a.shown_axes))]));

  const location = byId.get(scene.locationId);
  const nearestCityEntity = nearestCityId ? byId.get(nearestCityId) : undefined;
  const nearestCity =
    nearestCityEntity && nearestCityEntity.entity_kind === "location"
      ? { name: nearestCityEntity.name, slug: nearestCityEntity.slug }
      : null;

  return {
    locationId: scene.locationId,
    locationName: location?.name ?? "Lieu inconnu",
    locationSlug: location?.slug ?? null,
    nearestCity,
    roomName: scene.room && scene.room.locationId === scene.locationId ? scene.room.name : null,
    time: scene.time,
    lighting: scene.lighting,
    weather: scene.weather,
    inCombat: scene.activeCombatId !== null,
    present: ici.map((p) => ({
      entityId: p.entityId,
      name: byId.get(p.entityId)?.name ?? p.entityId,
      zone: p.zone,
      disposition: p.disposition,
      perception: perceptionById.get(p.entityId) ?? null,
    })),
    sketches: esquissesIci(scene).map((s) => ({ id: s.id, name: s.name, trait: s.trait, zone: s.zone, disposition: s.disposition })),
  };
}

/**
 * V3-D2 — La date de la scene, formatee ("Mercredi 12 mars 1247"), pour
 * l'en-tete d'etat. `null` si le calendrier du monde n'a pas de date
 * "aujourd'hui" reglee a la precision du jour (`sceneCalendarDate`) : on
 * omet plutot que d'afficher une date inventee, meme principe que la
 * meteo (V3-C6, pas encore faite).
 */
export function sceneDateLabel(sceneDay: number, calendar: CalendarConfigInput): string | null {
  const date = sceneCalendarDate(sceneDay, calendar);
  if (date === null) return null;
  const weekday = weekdayNameForDate(date, calendar);
  const formatted = formatGameDate(date, calendar);
  return weekday ? `${weekday} ${formatted}` : formatted;
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
 *
 * **V3-C4** — poser une scène ici découvre : le lieu et les présents passent
 * `known` (le joueur y est, ou les y voit), le lieu qui les contient
 * (« la ville la plus proche », déjà résolu pour l'en-tête, V3-D2) passe
 * `mentioned` — le joueur en a entendu parler sans y être allé. Jamais de
 * régression (`discoverEntity`) : rejouer la même scène ne rétrograde rien.
 *
 * **V3-C6** — un CHANGEMENT de lieu tire une météo fraîche (jamais en
 * ré-enregistrant la même scène, sinon elle changerait à chaque « présents »
 * retouché sans raison en jeu). Tirée APRÈS avoir écrit le nouveau lieu :
 * `generateForScene` relit lui-même la scène pour résoudre ses axes
 * (richesse/zone du lieu COURANT, V3-C1) — la tirer avant aurait résolu ces
 * axes sur l'ANCIEN lieu, encore en base à cet instant.
 */
export async function setScene(
  supabase: TypedClient,
  params: { campaignId: string; worldId: string; locationId: string; present: string[]; callerId: string }
): Promise<SceneState> {
  const existing = await getSceneState(supabase, params.campaignId);
  const locationChanged = !existing || existing.locationId !== params.locationId;
  let scene = existing ? { ...existing, locationId: params.locationId } : emptyScene(params.locationId);
  // V3-C2 : une esquisse ne survit qu'a son lieu de tirage — changer de lieu la laisse derriere.
  scene = dropSketchesOutsideLocation(scene, params.locationId);
  // V3.2-19 : la pièce et ses esquisses ne survivent pas non plus au changement de lieu.
  scene = dropRoomsOutsideLocation(scene, params.locationId);
  // V3.2-28 : un autre lieu, pas de pièce ; ceux qui y arrivent avec le personnage sont avec lui.
  // Ceux qui ne suivent pas restent dans l'ancien lieu, quelle que soit leur pièce.
  const wanted = new Set(params.present);
  if (locationChanged) scene = oublierLesPieces({ ...scene, present: scene.present.filter((p) => wanted.has(p.entityId)) });

  // V3.2-28 : la liste dit « qui est avec moi ». Ceux d'une autre pièce du lieu
  // n'en sortent pas parce que le panneau ne les montrait pas ; nommés, ils viennent ici.
  for (const current of presentsIci(scene)) {
    if (!wanted.has(current.entityId)) scene = leaveScene(scene, current.entityId);
  }
  scene = ramenerIci(scene, params.present.filter((id) => scene.present.some((p) => p.entityId === id)));
  for (const entityId of params.present) {
    scene = enterScene(scene, { entityId, zone: "near" });
  }

  const running = (await listCombatsForCampaign(supabase, params.campaignId)).find((c) => c.status === "running");
  scene = { ...scene, activeCombatId: running?.id ?? null };

  // V3.2-31 : un autre lieu (ou une scène d'avant ce ticket), on relit ce qui le fait vivre ; ensuite l'heure suffit.
  const edges = await listPartOfRelationsForWorld(supabase, params.worldId);
  if (locationChanged || !scene.life) {
    scene = poserLaVie(scene, await lireLaVieDuLieu(supabase, { worldId: params.worldId, locationId: params.locationId, edges }));
  }

  await putSceneState(supabase, { campaignId: params.campaignId, state: scene, updatedBy: params.callerId });

  if (locationChanged) {
    scene = { ...scene, weather: await drawWeather(supabase, { campaignId: params.campaignId, worldId: params.worldId, callerId: params.callerId }) };
    await putSceneState(supabase, { campaignId: params.campaignId, state: scene, updatedBy: params.callerId });
  }

  const nearestCityId = edges.find((e) => e.source_entity_id === params.locationId)?.target_entity_id ?? null;
  await discoverEntity(supabase, { campaignId: params.campaignId, userId: params.callerId, entityId: params.locationId, level: "known" });
  if (nearestCityId) {
    await discoverEntity(supabase, { campaignId: params.campaignId, userId: params.callerId, entityId: nearestCityId, level: "mentioned" });
  }
  for (const entityId of params.present) {
    await discoverEntity(supabase, { campaignId: params.campaignId, userId: params.callerId, entityId, level: "known" });
  }

  return scene;
}
