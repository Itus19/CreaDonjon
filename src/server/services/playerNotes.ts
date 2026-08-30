import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import type { EntitySummary } from "@/src/server/repos/entities";
import { findEntityByCreatorAndKind } from "@/src/server/repos/entities";
import { listBlocksForEntity, insertBlock, type BlockRow } from "@/src/server/repos/blocks";
import { createEntity } from "@/src/server/services/entities";

type TypedClient = SupabaseClient<Database>;

export interface PlayerNotes {
  entityId: string;
  blockId: string;
  version: number;
  text: string;
  /** Necessaire cote client pour reconstruire un segment valide (`visibility.scopeId`) au moment de sauver via `/api/blocks/[blockId]` — jamais utilise pour une verification de droit, deja faite par cette route. */
  userId: string;
}

/**
 * Segment narratif minimal pour un simple bloc de texte libre (retour
 * utilisateur, coquille joueur) : un seul paragraphe, un seul noeud texte —
 * jamais le modele riche complet (styles, references...), hors de portee
 * d'un textarea simple. Reutilise `zTextBlockData` tel quel (meme table,
 * memes blocs, specs/module-joueur-et-solo.md "Ce qui reste ouvert" :
 * "entite notes privee par joueur, avec les blocs existants, pas de second
 * systeme") — juste une serialisation/deserialisation la plus simple
 * possible d'un côté comme de l'autre.
 */
function textToBlockData(text: string, userId: string): Json {
  if (!text) return { __v: 1, segments: [] } as unknown as Json;
  return {
    __v: 1,
    segments: [
      {
        id: "notes",
        blockType: "paragraph",
        visibility: { level: "user", scopeId: userId },
        content: [{ t: "text", v: text }],
        align: "left",
      },
    ],
  } as unknown as Json;
}

function blockDataToText(data: Json): string {
  const segments = (data as { segments?: { content?: { t: string; v?: string }[] }[] })?.segments ?? [];
  return segments
    .map((seg) => (seg.content ?? []).filter((n) => n.t === "text").map((n) => n.v ?? "").join(""))
    .join("\n");
}

/**
 * Recupere (ou cree au premier passage) la fiche de notes privee d'un
 * compte dans ce monde, avec son unique bloc `text` — jamais plus d'une
 * fiche par compte par monde (`findEntityByCreatorAndKind`). L'ecriture
 * passe ensuite par la route generique `/api/blocks/[blockId]`
 * (`updateBlockContent`, deja gatee par `canUserEditEntityById` — 5e cas de
 * `canEditEntity`, V2-M7b) : rien de nouveau a ecrire cote sauvegarde.
 */
export async function getOrCreatePlayerNotes(
  supabase: TypedClient,
  params: { worldId: string; userId: string }
): Promise<PlayerNotes> {
  let entity: EntitySummary | null = await findEntityByCreatorAndKind(supabase, {
    worldId: params.worldId,
    createdBy: params.userId,
    entityKind: "notes",
  });
  if (!entity) {
    entity = await createEntity(supabase, {
      worldId: params.worldId,
      createdBy: params.userId,
      name: "Mes notes",
      entityKind: "notes",
      aliases: [],
    });
  }

  const blocks = await listBlocksForEntity(supabase, entity.id);
  let block: BlockRow | undefined = blocks.find((b) => b.block_type === "text");
  if (!block) {
    block = await insertBlock(supabase, {
      entityId: entity.id,
      blockType: "text",
      display: { label: "Notes", layout: "prose" },
      data: textToBlockData("", params.userId),
      displayOrder: 1000,
      visibilityLevel: "user",
      visibilityScopeId: params.userId,
      createdBy: params.userId,
    });
  }

  return { entityId: entity.id, blockId: block.id, version: block.version, text: blockDataToText(block.data), userId: params.userId };
}
