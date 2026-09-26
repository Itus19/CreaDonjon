import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import { addSketch, enterScene, recordSketchSpoke, removeSketch, sketchShouldAnchorForSpeaking, textNamesSketch, type SceneSketch } from "@/src/core/rules/scene";
import { getSceneState, putSceneState } from "@/src/server/repos/sceneStates";
import { insertSessionEvent, listSketchAppearancesByName, nextEventSeq } from "@/src/server/repos/sessions";
import { generateForScene } from "@/src/server/services/sceneGeneration";
import { promoteToEntity, type PromoteToEntityResult } from "@/src/server/services/promotion";
import type { EntitySummary } from "@/src/server/repos/entities";

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
    await journalSketchNote(supabase, params.sessionId, params.callerId, `${name} revient — ancré dans le monde dès sa deuxième apparition`, {
      source: "anchor",
      entity_id: promoted.entity.id,
      name,
    });
    return { ok: true, anchored: true, entity: promoted.entity };
  }

  const sketch: SceneSketch = { id: crypto.randomUUID(), name, trait, zone: "near", timesSpoken: 0, locationId: scene.locationId };
  await putSceneState(supabase, { campaignId: params.campaignId, state: addSketch(scene, sketch), updatedBy: params.callerId });
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
  const withEntity = enterScene(withoutSketch, { entityId: promoted.entity.id, zone: sketch.zone, disposition: sketch.disposition });
  await putSceneState(supabase, { campaignId: params.campaignId, state: withEntity, updatedBy: params.callerId });
  await journalSketchNote(supabase, params.sessionId, params.callerId, `${sketch.name} a rejoint le monde`, {
    source: "anchor",
    entity_id: promoted.entity.id,
    name: sketch.name,
  });
  return promoted;
}

/**
 * Après qu'une narration a fait parler une esquisse (`npc_reaction`) : compte
 * la réplique, ancre au-delà du seuil (`sketchShouldAnchorForSpeaking`).
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
    await promoteSketch(supabase, { ...params });
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
      await promoteSketch(supabase, { campaignId: params.campaignId, worldId: params.worldId, sessionId: params.sessionId, sketchId: sketch.id, callerId: params.callerId });
    }
  }
}

async function journalSketchNote(supabase: TypedClient, sessionId: string, callerId: string, note: string, extra: Record<string, unknown>): Promise<void> {
  const seq = await nextEventSeq(supabase, sessionId);
  await insertSessionEvent(supabase, {
    sessionId,
    seq,
    kind: "world_update",
    actor: "system",
    actorUserId: callerId,
    payload: { __v: 1, note, ...extra } as unknown as Json,
  });
}
