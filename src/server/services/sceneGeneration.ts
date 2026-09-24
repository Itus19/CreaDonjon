import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import { SeededRng } from "@/src/core/dice/rng";
import { GENERATOR_TOOLS } from "@/src/core/generators/tools";
import { isFragmentNameSlot, isProseSlot } from "@/src/core/generators/types";
import { renderGeneratorTemplate } from "@/src/core/generators/render";
import { resolveSceneVariant, sceneTableKey, type ResolvedSceneAxis } from "@/src/core/generators/sceneVariant";
import { zInfoboxBlockData, type InfoboxEntry } from "@/src/core/schemas/blocks/infobox";
import { getSceneState } from "@/src/server/repos/sceneStates";
import { findEntityByKind } from "@/src/server/repos/entities";
import { listBlocksByTypeForEntities } from "@/src/server/repos/blocks";
import { listPartOfRelationsForWorld } from "@/src/server/repos/relations";
import { insertSessionEvent, nextEventSeq } from "@/src/server/repos/sessions";
import { drawTableSlotsFromGeneratorBlock, findGeneratorBlockIdByKey } from "@/src/server/services/generators";
import { getOrOpenSessionForCampaign } from "@/src/server/services/sessions";
import { serverRng } from "@/src/server/services/rng";

type TypedClient = SupabaseClient<Database>;

/**
 * V3-C1 — Le pont generateur ↔ moteur.
 *
 * Les generateurs etaient un outil de MJ : on clique, on lit, on decide. Ici
 * c'est le moteur qui les invoque, au rang 2 de la hierarchie des sources du
 * lot C (le wiki d'abord, les generateurs ensuite, le modele jamais pour un
 * fait). Ce module ne decide pas QUAND tirer — c'est l'affaire des tickets
 * suivants (esquisses, ecriture du wiki) — seulement COMMENT : avec les
 * axes du lieu courant, un RNG rejouable, et une trace au journal.
 *
 * **Rejouable** : une graine fraiche est tiree par `serverRng`, puis tout le
 * tirage — axes aleatoires compris — passe par un `SeededRng` de cette
 * graine. La graine est journalisee : la rejouer contre les memes tables
 * redonne le meme resultat.
 *
 * **Zero changement au moteur de generateurs** : chaque section passe par
 * `drawTableSlotsFromGeneratorBlock` telle quelle, avec des axes deja
 * resolus (jamais la valeur « aleatoire », sinon chaque section tirerait sa
 * propre richesse). Les emplacements `prose` restent vides : l'habillage
 * par le modele vient apres, et il n'arbitre rien.
 */

/** Profondeur maximale de la remontee `part_of` (taverne → quartier → ville → region → royaume). Borne aussi un cycle mal saisi. */
const MAX_PLACE_DEPTH = 5;

export interface SceneGenerationSlot {
  key: string;
  text: string;
  /** Cle de table tiree, pour un emplacement `table`. */
  table?: string;
  die?: string;
  rolled?: number;
}

export interface SceneGenerationSection {
  key: string;
  label: string;
  text: string;
  slots: SceneGenerationSlot[];
}

export interface SceneGenerationResult {
  eventId: string;
  tool: string;
  seed: number;
  variant: Record<string, ResolvedSceneAxis>;
  sections: SceneGenerationSection[];
}

export type SceneGenerationError = "unknown_tool" | "no_scene" | "no_generators";

/** Le lieu courant puis ses parents `part_of`, du plus proche au plus lointain. */
function placeChain(locationId: string, edges: { source_entity_id: string; target_entity_id: string }[]): string[] {
  const chain = [locationId];
  while (chain.length < MAX_PLACE_DEPTH) {
    const parent = edges.find((e) => e.source_entity_id === chain[chain.length - 1])?.target_entity_id;
    if (!parent || chain.includes(parent)) break;
    chain.push(parent);
  }
  return chain;
}

async function infoboxEntriesByPlace(supabase: TypedClient, placeIds: string[]): Promise<InfoboxEntry[][]> {
  const rows = await listBlocksByTypeForEntities(supabase, placeIds, "infobox");
  const sorted = [...rows].sort((a, b) => a.display_order - b.display_order);
  return placeIds.map((id) =>
    sorted
      .filter((row) => row.entity_id === id)
      .flatMap((row) => {
        const parsed = zInfoboxBlockData.safeParse(row.data);
        return parsed.success ? parsed.data.entries : [];
      })
  );
}

/**
 * Tire toutes les sections d'un outil (`taverne`, `pnj`, `echoppe`,
 * `noms`, `butin`) pour la scene de la campagne, et le journalise.
 *
 * `choices` ne porte que les axes qui ne disent rien du lieu (type
 * d'echoppe, genre, rarete) ; une valeur pour `wealth` ou `zone` y est
 * ignoree. Il vient de l'appelant — du code — jamais d'une sortie de modele.
 */
export async function generateForScene(
  supabase: TypedClient,
  params: {
    campaignId: string;
    worldId: string;
    toolKey: string;
    choices?: Record<string, string>;
    callerId: string;
  }
): Promise<SceneGenerationResult | { error: SceneGenerationError }> {
  const tool = GENERATOR_TOOLS.find((t) => t.key === params.toolKey);
  if (!tool) return { error: "unknown_tool" };

  const scene = await getSceneState(supabase, params.campaignId);
  if (!scene) return { error: "no_scene" };

  const generatorsEntity = await findEntityByKind(supabase, params.worldId, "generateur");
  if (!generatorsEntity) return { error: "no_generators" };

  const edges = await listPartOfRelationsForWorld(supabase, params.worldId);
  const places = await infoboxEntriesByPlace(supabase, placeChain(scene.locationId, edges));

  const seed = serverRng.nextInt(2 ** 32);
  const rng = new SeededRng(seed);
  const axes = tool.variants ?? [];
  const variant = resolveSceneVariant(axes, places, params.choices ?? {}, rng);
  const variantKeys = Object.fromEntries(Object.entries(variant).map(([axis, v]) => [axis, v.key]));
  const variantLabels = Object.fromEntries(Object.entries(variant).map(([axis, v]) => [axis, v.label]));

  const sections: SceneGenerationSection[] = [];
  for (const section of tool.sections) {
    const blockId = await findGeneratorBlockIdByKey(supabase, generatorsEntity.id, section.key);
    if (!blockId) continue;
    const draw = await drawTableSlotsFromGeneratorBlock(supabase, blockId, rng, { variant: variantKeys });
    if (!draw) continue;

    const emptyProse = Object.fromEntries(draw.proseSlots.map((s) => [s.key, ""]));
    const slots: SceneGenerationSlot[] = draw.slots.map((result) => {
      const config = draw.generator.slots.find((s) => s.key === result.key);
      const table = config && !isProseSlot(config) && !isFragmentNameSlot(config) ? sceneTableKey(config.table, axes, variant) : undefined;
      return {
        key: result.key,
        text: result.text,
        ...(table !== undefined ? { table } : {}),
        ...(result.die !== undefined ? { die: result.die } : {}),
        ...(result.rolled !== undefined ? { rolled: result.rolled } : {}),
      };
    });
    sections.push({
      key: section.key,
      label: section.label,
      text: renderGeneratorTemplate(draw.generator.template, { ...draw.slotTexts, ...emptyProse, ...variantLabels }),
      slots,
    });
  }

  const sessionId = await getOrOpenSessionForCampaign(supabase, params.campaignId);
  const seq = await nextEventSeq(supabase, sessionId);
  const event = await insertSessionEvent(supabase, {
    sessionId,
    seq,
    kind: "world_update",
    actor: "system",
    actorUserId: params.callerId,
    payload: {
      __v: 1,
      source: "generator",
      tool: tool.key,
      location_id: scene.locationId,
      seed,
      variant,
      sections,
      note: `Tirage « ${tool.label} » : ${sections.length} section${sections.length > 1 ? "s" : ""}`,
    } as unknown as Json,
  });

  return { eventId: event.id, tool: tool.key, seed, variant, sections };
}
