import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { zTextBlockData } from "@/src/core/schemas/blocks/text";
import { zStatblockBlockData, type StatblockBlockData } from "@/src/core/schemas/blocks/statblock";
import type { SegmentContentNode } from "@/src/core/schemas/entities/segments";
import { createEntity } from "@/src/server/services/entities";
import { createBlock, updateBlockContent } from "@/src/server/services/blocks";
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
    const created = await createBlock(supabase, {
      entityId: entity.id,
      blockType: "statblock",
      label: params.statblock.label,
      visibilityLevel: params.visibilityLevel,
      visibilityScopeId: params.visibilityScopeId,
      createdBy: params.createdBy,
    });
    if (!created.ok) return { ok: false, reason: "forbidden" };
    const block = created.block;
    const saved = await updateBlockContent(supabase, {
      id: block.id,
      expectedVersion: block.version,
      display: block.display,
      data: zStatblockBlockData.parse(params.statblock.data),
      visibilityLevel: block.visibilityLevel,
      visibilityScopeId: block.visibilityScopeId,
      changedBy: params.createdBy,
    });
    if (!saved.ok) return { ok: false, reason: "forbidden" };
  }

  return { ok: true, entity };
}
