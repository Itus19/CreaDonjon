import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import { addSketch, enterScene, recordSketchSpoke, removeSketch, sketchShouldAnchorForSpeaking, textNamesSketch, type SceneSketch } from "@/src/core/rules/scene";
import { getSceneState, putSceneState } from "@/src/server/repos/sceneStates";
import { insertSessionEvent, listSketchAppearancesByName, nextEventSeq } from "@/src/server/repos/sessions";
import { insertAiProposal } from "@/src/server/repos/aiProposals";
import { generateForScene } from "@/src/server/services/sceneGeneration";
import { promoteToEntity, type PromoteToEntityResult } from "@/src/server/services/promotion";
import { discoverEntity } from "@/src/server/services/discoveries";
import type { EntitySummary } from "@/src/server/repos/entities";
import type { SceneState } from "@/src/core/rules/scene";
import { ancrerPersonneCalculee, archetypeCalcule, graineCalculee, roleCalcule } from "@/src/core/rules/sceneLife";
import { deriveSeed } from "@/src/core/worldgen/seed";
import { giveNpcSheet } from "@/src/server/services/npcSheet";
import { insertRelation } from "@/src/server/repos/relations";
import { upsertTrueName } from "@/src/server/repos/entityTrueNames";
import { isWorldAdmin } from "@/src/server/services/permissions";

type TypedClient = SupabaseClient<Database>;

/**
 * V3-C2 — Les esquisses : un personnage incident tiré au générateur (jamais
 * inventé par le modèle), qui vit dans `scene_states.state.sketches` tant
 * qu'il n'est pas ancré (`promoteToEntity`) — voir `src/core/rules/scene.ts`
 * pour ce que le noyau pur garantit, ce fichier ne fait que le brancher sur
 * la base et le journal.
 *
 * **Hiérarchie des sources, jamais inversée** (`sceneGeneration.ts`) : le
 * nom et le trait viennent TOUJOURS du tirage `pnj` (dés réels, graine
 * journalisée) — jamais du texte que le modèle aurait proposé.
 */

const PNJ_TOOL_KEY = "pnj";
const NAME_SECTION_KEY = "pnj-nom";
const TRAIT_SECTION_KEY = "pnj-apparence";

export type DrawSketchOutcome =
  | { ok: true; anchored: false; sketch: SceneSketch }
  | { ok: true; anchored: true; entity: EntitySummary }
  | { ok: false; reason: string };

/**
 * Tire un personnage incident pour la scène courante. Si un tirage
 * antérieur portait déjà ce nom, dans un AUTRE lieu (`payload.source ===
 * "sketch"` du journal), c'est la seconde apparition prévue par le ticket
 * (« apparaît dans une deuxième scène ») : ancrage immédiat, jamais une
 * esquisse de plus sous le même nom.
 */
export async function drawSketchForScene(
  supabase: TypedClient,
  params: { campaignId: string; worldId: string; sessionId: string; callerId: string }
): Promise<DrawSketchOutcome> {
  const drawn = await generateForScene(supabase, { campaignId: params.campaignId, worldId: params.worldId, toolKey: PNJ_TOOL_KEY, callerId: params.callerId });
  if ("error" in drawn) return { ok: false, reason: drawn.error };

  const name = drawn.sections.find((s) => s.key === NAME_SECTION_KEY)?.text.trim();
  if (!name) return { ok: false, reason: "nom manquant au tirage" };
  const trait = drawn.sections.find((s) => s.key === TRAIT_SECTION_KEY)?.text.trim() || "aucun trait notable";

  const scene = await getSceneState(supabase, params.campaignId);
  if (!scene) return { ok: false, reason: "no_scene" };

  const priorAppearances = await listSketchAppearancesByName(supabase, params.sessionId, name);
  if (priorAppearances.some((a) => a.locationId !== scene.locationId)) {
    const promoted = await promoteToEntity(supabase, {
      worldId: params.worldId,
      createdBy: params.callerId,
      name,
      entityKind: "character",
      visibilityLevel: "public",
      visibilityScopeId: null,
      blocks: [{ label: "Description", text: trait }],
    });
    if (!promoted.ok) return { ok: false, reason: "forbidden" };
    await putSceneState(supabase, { campaignId: params.campaignId, state: enterScene(scene, { entityId: promoted.entity.id, zone: "near" }), updatedBy: params.callerId });
    const eventId = await journalSketchNote(supabase, params.sessionId, params.callerId, `${name} revient — ancré dans le monde dès sa deuxième apparition`, {
      source: "anchor",
      entity_id: promoted.entity.id,
      name,
    });
    await recordAnchorProposal(supabase, { worldId: params.worldId, campaignId: params.campaignId, sessionEventId: eventId, entity: promoted.entity, name, trait, callerId: params.callerId });
    return { ok: true, anchored: true, entity: promoted.entity };
  }

  const sketch: SceneSketch = { id: crypto.randomUUID(), name, trait, zone: "near", timesSpoken: 0, locationId: scene.locationId };
  await putSceneState(supabase, { campaignId: params.campaignId, state: addSketch(scene, sketch), updatedBy: params.callerId });
  // V3-C3 — pas de proposition ici : rien n'est ecrit sur une entite tant
  // que l'esquisse n'est pas ancree (aucun `target_entity_id` a porter).
  await journalSketchNote(supabase, params.sessionId, params.callerId, `${name} entre dans la scène`, {
    source: "sketch",
    sketch_id: sketch.id,
    name,
    trait,
    location_id: scene.locationId,
  });
  return { ok: true, anchored: false, sketch };
}

/** Ancre une esquisse — clic « garder cette fiche », ou l'un des seuils automatiques (parole, nom donné). Toujours le MÊME mécanisme (`promoteToEntity`), jamais un second. */
export async function promoteSketch(
  supabase: TypedClient,
  params: { campaignId: string; worldId: string; sessionId: string; sketchId: string; callerId: string }
): Promise<PromoteToEntityResult | { ok: false; reason: "not_found" }> {
  const scene = await getSceneState(supabase, params.campaignId);
  const sketch = scene?.sketches.find((s) => s.id === params.sketchId);
  if (!scene || !sketch) return { ok: false, reason: "not_found" };

  const promoted = await promoteToEntity(supabase, {
    worldId: params.worldId,
    createdBy: params.callerId,
    name: sketch.name,
    entityKind: "character",
    visibilityLevel: "public",
    visibilityScopeId: null,
    blocks: [{ label: "Description", text: sketch.trait }],
  });
  if (!promoted.ok) return promoted;

  const withoutSketch = removeSketch(scene, sketch.id);
  let withEntity = enterScene(withoutSketch, { entityId: promoted.entity.id, zone: sketch.zone, disposition: sketch.disposition, ...(sketch.room !== undefined ? { room: sketch.room } : {}) });
  // V3.2-45 : une personne calculée reçoit son vrai nom en s'ancrant, et garde sa place dans le lieu.
  const seed = graineCalculee(sketch.id);
  if (seed !== null) {
    await nommerPersonneCalculee(supabase, { ...params, scene, entityId: promoted.entity.id, seed });
    withEntity = ancrerPersonneCalculee(withEntity, { sketchId: sketch.id, entityId: promoted.entity.id });
  }
  // V3.2-47 : la fiche allégée, d'après l'archétype de vie (personne calculée) ou, à défaut, un Roturier.
  // Une esquisse du générateur n'a pas de graine de ville : la sienne se dérive de son identifiant.
  const archetype = seed !== null ? (archetypeCalcule(scene, seed) ?? undefined) : undefined;
  const sheet = await giveNpcSheet(supabase, {
    worldId: params.worldId,
    entityId: promoted.entity.id,
    ...(archetype !== undefined ? { archetype } : {}),
    seed: seed ?? deriveSeed(0, sketch.id),
    callerId: params.callerId,
  });
  if (!sheet.ok) console.warn(`Pas de fiche allégée pour une personne ancrée (${sheet.reason})`);
  await putSceneState(supabase, { campaignId: params.campaignId, state: withEntity, updatedBy: params.callerId });
  const eventId = await journalSketchNote(supabase, params.sessionId, params.callerId, `${sketch.name} a rejoint le monde`, {
    source: "anchor",
    entity_id: promoted.entity.id,
    name: sketch.name,
  });
  await recordAnchorProposal(supabase, { worldId: params.worldId, campaignId: params.campaignId, sessionEventId: eventId, entity: promoted.entity, name: sketch.name, trait: sketch.trait, callerId: params.callerId });
  return promoted;
}

/**
 * V3.2-45 (décision de l'auteur, 26 novembre 2026) — Une personne calculée
 * (« aubergiste, d'âge mûr ») qui s'ancre reçoit un vrai nom, tiré au
 * générateur PNJ (dés réels, journalisé), jamais inventé par l'IA. Ce nom
 * reste secret tant que le personnage ne l'a pas appris : c'est le « nom pour
 * la table » des parties à table (ADR 0105). La fiche s'appelle par le
 * libellé, et le vrai nom part dans `entity_true_names`, que seul le MJ lit.
 *
 * Personne du personnel : un lien `works_at` vers le lieu, avec sa graine,
 * pour qu'elle reprenne sa place en revenant plus tard (`lireLaVieDuLieu`).
 *
 * Sans droit de MJ sur le monde, ou sans générateur, la fiche garde son
 * libellé comme seul nom : rien n'est perdu, rien n'est inventé.
 */
async function nommerPersonneCalculee(
  supabase: TypedClient,
  params: { worldId: string; campaignId: string; callerId: string; scene: SceneState; entityId: string; seed: number }
): Promise<void> {
  const role = roleCalcule(params.scene, params.seed);
  if (params.scene.life && (role === "head" || role === "staff")) {
    const lien = await insertRelation(supabase, {
      worldId: params.worldId,
      sourceEntityId: params.entityId,
      targetEntityId: params.scene.life.locationId,
      relationType: "works_at",
      visibilityLevel: "public",
      visibilityScopeId: null,
      createdBy: params.callerId,
      metadata: { seed: params.seed },
    });
    if (!lien.ok) console.warn(`Lien works_at non créé pour une personne ancrée (${lien.reason})`);
  }

  if (!(await isWorldAdmin(supabase, { worldId: params.worldId, userId: params.callerId }))) return;
  const drawn = await generateForScene(supabase, { campaignId: params.campaignId, worldId: params.worldId, toolKey: PNJ_TOOL_KEY, callerId: params.callerId });
  if ("error" in drawn) {
    console.warn(`Pas de vrai nom pour une personne ancrée : ${drawn.error}`);
    return;
  }
  const trueName = drawn.sections.find((s) => s.key === NAME_SECTION_KEY)?.text.trim();
  if (!trueName) return;
  await upsertTrueName(supabase, { entityId: params.entityId, worldId: params.worldId, secret: { trueName, trueAliases: [] } });
}

/**
 * Après un échange avec une esquisse (réplique, ou servie sans un mot, V3.2-44) : compte
 * l'échange, ancre au-delà du seuil (`sketchShouldAnchorForSpeaking`).
 * Best-effort — appelé après que la narration est déjà journalisée, un échec
 * ici ne doit rien lui retirer (même discipline que `narrateSoloTurn`
 * lui-même vis-à-vis de `playTurn`).
 */
export async function recordSketchSpeechAndMaybeAnchor(
  supabase: TypedClient,
  params: { campaignId: string; worldId: string; sessionId: string; sketchId: string; callerId: string }
): Promise<void> {
  const scene = await getSceneState(supabase, params.campaignId);
  if (!scene || !scene.sketches.some((s) => s.id === params.sketchId)) return;

  const updated = recordSketchSpoke(scene, params.sketchId);
  await putSceneState(supabase, { campaignId: params.campaignId, state: updated, updatedBy: params.callerId });

  const sketch = updated.sketches.find((s) => s.id === params.sketchId);
  if (sketch && sketchShouldAnchorForSpeaking(sketch)) {
    const promoted = await promoteSketch(supabase, { ...params });
    if (!promoted.ok) console.error(`Ancrage de l'esquisse « ${sketch.name} » refusé : ${promoted.reason}`);
  }
}

/**
 * « Le joueur l'a nommée explicitement » (V3-C2) : son propre texte reprend
 * le nom de l'esquisse, mot entier — jamais un jugement du modèle. Best-effort,
 * appelé après `playTurn`, avant la narration (`app/api/solo/tour/route.ts`).
 */
export async function anchorSketchesNamedInText(
  supabase: TypedClient,
  params: { campaignId: string; worldId: string; sessionId: string; callerId: string; text: string }
): Promise<void> {
  const scene = await getSceneState(supabase, params.campaignId);
  if (!scene) return;

  for (const sketch of scene.sketches) {
    if (textNamesSketch(params.text, sketch.name)) {
      const promoted = await promoteSketch(supabase, { campaignId: params.campaignId, worldId: params.worldId, sessionId: params.sessionId, sketchId: sketch.id, callerId: params.callerId });
      // Un refus ne casse pas le tour, mais ne se tait pas non plus.
      if (!promoted.ok) console.error(`Ancrage de l'esquisse « ${sketch.name} » refusé : ${promoted.reason}`);
    }
  }
}

async function journalSketchNote(supabase: TypedClient, sessionId: string, callerId: string, note: string, extra: Record<string, unknown>): Promise<string> {
  const seq = await nextEventSeq(supabase, sessionId);
  const event = await insertSessionEvent(supabase, {
    sessionId,
    seq,
    kind: "world_update",
    actor: "system",
    actorUserId: callerId,
    payload: { __v: 1, note, ...extra } as unknown as Json,
  });
  return event.id;
}

/**
 * V3-C3 — « auto_applied est réellement utilisé » (docs/BACKLOG_V3.md) : un
 * ancrage d'esquisse crée bel et bien une entité, donc une ligne
 * `ai_proposals` `kind: "create_entity"`, déjà appliquée par le CODE
 * (jamais un modèle) — `auto_applied: true`, `status: "applied"`, liée à son
 * `session_event_id` pour que « annuler ce tour » (V3-F2, pas encore fait)
 * puisse un jour la retrouver.
 *
 * **V3-C4** — une esquisse ancrée est par définition rencontrée : `known`,
 * jamais seulement `mentioned` — elle vient d'entrer dans la scène.
 */
async function recordAnchorProposal(
  supabase: TypedClient,
  params: { worldId: string; campaignId: string; sessionEventId: string; entity: EntitySummary; name: string; trait: string; callerId: string }
): Promise<void> {
  await discoverEntity(supabase, {
    campaignId: params.campaignId,
    userId: params.callerId,
    entityId: params.entity.id,
    level: "known",
    sourceEventId: params.sessionEventId,
  });
  await insertAiProposal(supabase, {
    worldId: params.worldId,
    campaignId: params.campaignId,
    sessionEventId: params.sessionEventId,
    kind: "create_entity",
    targetEntityId: params.entity.id,
    payload: { name: params.name, trait: params.trait } as unknown as Json,
    status: "applied",
    autoApplied: true,
    appliedAt: new Date().toISOString(),
  });
}
