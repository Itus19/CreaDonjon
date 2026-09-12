import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { zTextBlockData } from "@/src/core/schemas/blocks/text";
import { zStatblockBlockData, type StatblockBlockData } from "@/src/core/schemas/blocks/statblock";
import { zQuestBlockData, type QuestBlockData } from "@/src/core/schemas/blocks/quest";
import { type PersonalityBlockData } from "@/src/core/schemas/blocks/personality";
import { type WorldviewBlockData } from "@/src/core/schemas/blocks/worldview";
import type { SegmentContentNode } from "@/src/core/schemas/entities/segments";
import { createEntity } from "@/src/server/services/entities";
import { createBlock, updateBlockContent } from "@/src/server/services/blocks";
import { addPersonalityEvent, addWorldviewEvent } from "@/src/server/services/psyche";
import type { PersonalityPoleKey, WorldviewPoleKey } from "@/src/core/psyche/keys";
import type { EntitySummary } from "@/src/server/repos/entities";

type TypedClient = SupabaseClient<Database>;

/** Noeud de reference deja etiquete (nom d'affichage resolu par l'appelant, ex. `resolveBlockReferences` — ce module ne connait ni ruleset ni locale). Meme forme que `zRefNode` (src/core/schemas/entities/segments.ts). */
export interface PromotedRefNode {
  kind: "entity" | "rule" | "asset";
  id?: string;
  key?: string;
  label: string;
}

export interface PromotedBlockSpec {
  label: string;
  text: string;
  refNodes?: PromotedRefNode[];
}

export type PromoteToEntityResult = { ok: true; entity: EntitySummary } | { ok: false; reason: "forbidden" };

/** Cree un bloc puis lui donne tout de suite son contenu — le pas commun a `statblock`/`quest` (jamais `personality`/`worldview` : leurs poles passent par le journal de psyche, cf. `createPsycheBlock` plus bas). */
async function createFilledBlock(
  supabase: TypedClient,
  params: { entityId: string; blockType: string; label: string; visibilityLevel: string; visibilityScopeId: string | null; createdBy: string; data: unknown }
): Promise<{ ok: true } | { ok: false }> {
  const created = await createBlock(supabase, {
    entityId: params.entityId,
    blockType: params.blockType,
    label: params.label,
    visibilityLevel: params.visibilityLevel,
    visibilityScopeId: params.visibilityScopeId,
    createdBy: params.createdBy,
  });
  if (!created.ok) return { ok: false };
  const saved = await updateBlockContent(supabase, {
    id: created.block.id,
    expectedVersion: created.block.version,
    display: created.block.display,
    data: params.data,
    visibilityLevel: created.block.visibilityLevel,
    visibilityScopeId: created.block.visibilityScopeId,
    changedBy: params.createdBy,
  });
  return saved.ok ? { ok: true } : { ok: false };
}

/**
 * Cree un bloc `personality`/`worldview` et lui donne son contenu non-pole
 * (aspirations, priorite, etc. — un PATCH generique ordinaire). Les poles
 * restent a 0 en sortie : le registre de blocs (src/core/schemas/blocks/
 * registry.ts) interdit explicitement de les ecrire par ce PATCH — ils ne
 * changent QUE via le journal `personality_events` (`addPersonalityEvent`/
 * `addWorldviewEvent`, src/server/services/psyche.ts), meme pour un PNJ
 * tout juste genere. L'appelant applique donc les poles dans un second
 * temps, avec la version fraiche renvoyee ici.
 */
async function createPsycheBlockShell(
  supabase: TypedClient,
  params: { entityId: string; blockType: "personality" | "worldview"; label: string; visibilityLevel: string; visibilityScopeId: string | null; createdBy: string; restData: Record<string, unknown> }
): Promise<{ ok: true; blockId: string; expectedVersion: number } | { ok: false }> {
  const created = await createBlock(supabase, {
    entityId: params.entityId,
    blockType: params.blockType,
    label: params.label,
    visibilityLevel: params.visibilityLevel,
    visibilityScopeId: params.visibilityScopeId,
    createdBy: params.createdBy,
  });
  if (!created.ok) return { ok: false };

  const withRest = await updateBlockContent(supabase, {
    id: created.block.id,
    expectedVersion: created.block.version,
    display: created.block.display,
    data: { ...(created.block.data as Record<string, unknown>), ...params.restData },
    visibilityLevel: created.block.visibilityLevel,
    visibilityScopeId: created.block.visibilityScopeId,
    changedBy: params.createdBy,
  });
  if (!withRest.ok) return { ok: false };

  return { ok: true, blockId: created.block.id, expectedVersion: withRest.block.version };
}

/**
 * Mecanisme generique de promotion en entite (V1-E6, V2-J2) : cree une
 * entite puis, pour chaque `PromotedBlockSpec`, un bloc `text` avec le
 * texte en premier paragraphe et — si des `refNodes` sont fournis — un
 * second paragraphe "Références : " portant ces references comme noeuds
 * `ref` inline (meme mecanisme que les mentions du wiki,
 * specs/wiki-liens-et-personnages.md). Jamais une ligne `relations` :
 * le vocabulaire de `relations` est ferme (src/core/relations/inverses.ts,
 * contrainte CHECK) et n'a pas de type generique ("mentionne") — deviner
 * une semantique serait pire que ne rien lier.
 *
 * Reutilise `createEntity`/`createBlock`/`updateBlockContent` tels quels,
 * meme sequence que l'ancien `promoteTimelineEntry` avant son extraction
 * ici (src/server/services/timeline.ts) — c'est le seul et meme mecanisme
 * pour les deux consommateurs, pas une seconde implementation parallele.
 */
export async function promoteToEntity(
  supabase: TypedClient,
  params: {
    worldId: string;
    createdBy: string;
    name: string;
    entityKind: string;
    visibilityLevel: string;
    visibilityScopeId: string | null;
    blocks: PromotedBlockSpec[];
    /** Bloc `statblock` optionnel (V2-J-PNJ) — creature du bestiaire deja convertie par `statblockFromMonsterBlocks` (src/core/rules/srdMapping.ts). */
    statblock?: { label: string; data: StatblockBlockData } | null;
    /** Bloc `personality` optionnel (V2-J-PNJ) — poles deja tires (`randomPoles`, src/core/psyche/random.ts), reste du bloc (aspirations/lignes/limites/registre) deja compose depuis les emplacements de la section "Personnalité". */
    personality?: { label: string; poleDeltas: Record<string, number>; rest: Omit<PersonalityBlockData, "__v" | "poles"> } | null;
    /** Bloc `worldview` optionnel (V2-J-PNJ) — mêmes poles, sans section dediee (rien a prevoir a l'ecran, cf. `GeneratorToolPromoteConfig.withWorldview`). */
    worldview?: { label: string; poleDeltas: Record<string, number>; rest: Omit<WorldviewBlockData, "__v" | "poles"> } | null;
    /** Bloc `quest` optionnel (V2-J-PNJ) — objectif/recompense tires depuis la section "Quête". */
    quest?: { label: string; data: QuestBlockData } | null;
  }
): Promise<PromoteToEntityResult> {
  const entity = await createEntity(supabase, {
    worldId: params.worldId,
    createdBy: params.createdBy,
    name: params.name,
    entityKind: params.entityKind,
    aliases: [],
  });

  for (const spec of params.blocks) {
    if (spec.text.trim() === "" && (!spec.refNodes || spec.refNodes.length === 0)) continue;

    const created = await createBlock(supabase, {
      entityId: entity.id,
      blockType: "text",
      label: spec.label,
      visibilityLevel: params.visibilityLevel,
      visibilityScopeId: params.visibilityScopeId,
      createdBy: params.createdBy,
    });
    // `entity` vient d'etre creee par ce meme `createdBy` : seul un
    // proprietaire/editeur/MJ peut alors echouer ici (aucune revendication
    // ni octroi possible sur une entite qui vient de naitre) — mais un
    // refus reste un refus, jamais suppose impossible (meme remarque que
    // l'ancien promoteTimelineEntry).
    if (!created.ok) return { ok: false, reason: "forbidden" };
    const block = created.block;

    const segments = [];
    if (spec.text.trim() !== "") {
      segments.push({
        id: crypto.randomUUID(),
        blockType: "paragraph" as const,
        visibility: { level: "public" as const, scopeId: null },
        content: [{ t: "text" as const, v: spec.text }] satisfies SegmentContentNode[],
        align: "left" as const,
      });
    }
    if (spec.refNodes && spec.refNodes.length > 0) {
      const refContent: SegmentContentNode[] = [
        { t: "text", v: "Références : " },
        ...spec.refNodes.map((r) => ({ t: "ref" as const, kind: r.kind, id: r.id, key: r.key, label: r.label })),
      ];
      segments.push({
        id: crypto.randomUUID(),
        blockType: "paragraph" as const,
        visibility: { level: "public" as const, scopeId: null },
        content: refContent,
        align: "left" as const,
      });
    }

    const seeded = zTextBlockData.parse({ __v: 1, segments });
    const saved = await updateBlockContent(supabase, {
      id: block.id,
      expectedVersion: block.version,
      display: block.display,
      data: seeded,
      visibilityLevel: block.visibilityLevel,
      visibilityScopeId: block.visibilityScopeId,
      changedBy: params.createdBy,
    });
    if (!saved.ok) return { ok: false, reason: "forbidden" };
  }

  if (params.statblock) {
    const filled = await createFilledBlock(supabase, {
      entityId: entity.id,
      blockType: "statblock",
      label: params.statblock.label,
      visibilityLevel: params.visibilityLevel,
      visibilityScopeId: params.visibilityScopeId,
      createdBy: params.createdBy,
      data: zStatblockBlockData.parse(params.statblock.data),
    });
    if (!filled.ok) return { ok: false, reason: "forbidden" };
  }

  if (params.quest) {
    const filled = await createFilledBlock(supabase, {
      entityId: entity.id,
      blockType: "quest",
      label: params.quest.label,
      visibilityLevel: params.visibilityLevel,
      visibilityScopeId: params.visibilityScopeId,
      createdBy: params.createdBy,
      data: zQuestBlockData.parse(params.quest.data),
    });
    if (!filled.ok) return { ok: false, reason: "forbidden" };
  }

  if (params.personality) {
    const shell = await createPsycheBlockShell(supabase, {
      entityId: entity.id,
      blockType: "personality",
      label: params.personality.label,
      visibilityLevel: params.visibilityLevel,
      visibilityScopeId: params.visibilityScopeId,
      createdBy: params.createdBy,
      restData: { __v: 1, ...params.personality.rest },
    });
    if (!shell.ok) return { ok: false, reason: "forbidden" };
    const applied = await addPersonalityEvent(supabase, {
      blockId: shell.blockId,
      expectedVersion: shell.expectedVersion,
      summary: "Généré par l'outil PNJ",
      deltas: params.personality.poleDeltas as Partial<Record<PersonalityPoleKey, number>>,
      occurredAtIngame: null,
      origin: "system",
      actorUserId: params.createdBy,
    });
    if (!applied.ok) return { ok: false, reason: "forbidden" };
  }

  if (params.worldview) {
    const shell = await createPsycheBlockShell(supabase, {
      entityId: entity.id,
      blockType: "worldview",
      label: params.worldview.label,
      visibilityLevel: params.visibilityLevel,
      visibilityScopeId: params.visibilityScopeId,
      createdBy: params.createdBy,
      restData: { __v: 1, ...params.worldview.rest },
    });
    if (!shell.ok) return { ok: false, reason: "forbidden" };
    const applied = await addWorldviewEvent(supabase, {
      blockId: shell.blockId,
      expectedVersion: shell.expectedVersion,
      summary: "Généré par l'outil PNJ",
      deltas: params.worldview.poleDeltas as Partial<Record<WorldviewPoleKey, number>>,
      occurredAtIngame: null,
      origin: "system",
      actorUserId: params.createdBy,
    });
    if (!applied.ok) return { ok: false, reason: "forbidden" };
  }

  return { ok: true, entity };
}
