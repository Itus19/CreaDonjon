import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import { pageToSharedLink, SHARED_NOTE_ENTITY_NAME, SHARED_NOTE_KIND, unlinkUnknownEntityRefs } from "@/src/core/notebook/share";
import { zTextBlockData } from "@/src/core/schemas/blocks/text";
import type { NarrativeContent } from "@/src/core/schemas/entities/segments";
import { filterSegments } from "@/src/core/visibility";
import { insertBlock, listBlocksByTypeForEntities, listBlocksForEntity, type BlockRow } from "@/src/server/repos/blocks";
import { listEntitiesByKinds, softDeleteEntity } from "@/src/server/repos/entities";
import { claimSharedNoteGrant } from "@/src/server/repos/sharedNotes";
import { updateBlockContent } from "@/src/server/services/blocks";
import { resolveCampaignId } from "@/src/server/services/campaigns";
import { createEntity, listPlayerVisibleEntityIds } from "@/src/server/services/entities";
import { loadNotebookTree } from "@/src/server/services/notebook";
import { isWorldAdmin } from "@/src/server/services/permissions";
import { listJournalRoster } from "@/src/server/services/sessionJournal";
import { buildViewerForWorld } from "@/src/server/services/visibility";

type TypedClient = SupabaseClient<Database>;

/**
 * V3.1-41 (ADR 0037) — partager une page du cahier avec la table.
 *
 * La page devient une entité `shared_note` dont un bloc de texte porte le
 * titre (son libellé) et le contenu. « La table » est la visibilité `players`
 * du monde : son propriétaire et tous les membres de sa campagne (un monde =
 * une campagne). L'autrice l'écrit par un octroi (`claim_shared_note_grant`),
 * que le MJ peut reprendre. « Ne plus partager » repasse le bloc en
 * visibilité `user` de l'autrice : l'entité reste, son texte est intact,
 * plus personne d'autre ne le lit. Le nom de l'entité reste neutre
 * (`SHARED_NOTE_ENTITY_NAME`) : la RLS des entités laisse lire tout nom à tout
 * membre du monde, le titre n'y est donc jamais.
 */

export type ShareError = "not_found" | "forbidden" | "conflict";

/** Le bloc de texte d'une page partagée (un seul par entité). */
async function sharedTextBlock(supabase: TypedClient, entityId: string): Promise<BlockRow | null> {
  return (await listBlocksForEntity(supabase, entityId)).find((b) => b.block_type === "text") ?? null;
}

/** Change la visibilité du texte d'une page partagée, rien d'autre. */
async function setSharedVisibility(
  supabase: TypedClient,
  params: { entityId: string; userId: string; shared: boolean }
): Promise<{ ok: true } | { ok: false; reason: ShareError }> {
  const block = await sharedTextBlock(supabase, params.entityId);
  if (!block) return { ok: false, reason: "not_found" };
  const result = await updateBlockContent(supabase, {
    id: block.id,
    expectedVersion: block.version,
    display: block.display,
    data: block.data,
    visibilityLevel: params.shared ? "players" : "user",
    visibilityScopeId: params.shared ? null : params.userId,
    changedBy: params.userId,
  });
  return result.ok ? { ok: true } : { ok: false, reason: result.reason };
}

/** Annule une entité créée à moitié (octroi refusé, cahier modifié entre-temps). Journalisé si l'annulation échoue elle-même. */
async function abandonSharedNote(supabase: TypedClient, entityId: string): Promise<void> {
  try {
    await softDeleteEntity(supabase, entityId);
  } catch (erreur) {
    console.error("Page partagée abandonnée non supprimée", entityId, erreur);
  }
}

/**
 * Partage la page `itemId` du cahier de l'appelant. Idempotent : une page
 * déjà devenue lien `shared_page` est simplement (re)rendue visible de la
 * table.
 */
export async function shareNotebookPage(
  supabase: TypedClient,
  params: { worldId: string; userId: string; itemId: string }
): Promise<{ ok: true; entityId: string } | { ok: false; reason: ShareError }> {
  const { block: tree, items } = await loadNotebookTree(supabase, params);
  const item = items.find((i) => i.id === params.itemId);
  if (!item) return { ok: false, reason: "not_found" };

  if (item.kind === "shared_page") {
    const result = await setSharedVisibility(supabase, { entityId: item.targetId, userId: params.userId, shared: true });
    return result.ok ? { ok: true, entityId: item.targetId } : result;
  }
  if (item.kind !== "page") return { ok: false, reason: "not_found" };

  const entity = await createEntity(supabase, {
    worldId: params.worldId,
    createdBy: params.userId,
    name: SHARED_NOTE_ENTITY_NAME,
    entityKind: SHARED_NOTE_KIND,
    aliases: [],
  });
  if (!(await claimSharedNoteGrant(supabase, entity.id))) {
    await abandonSharedNote(supabase, entity.id);
    return { ok: false, reason: "forbidden" };
  }

  await insertBlock(supabase, {
    entityId: entity.id,
    blockType: "text",
    display: { label: item.title.trim() || "(sans titre)", layout: "prose" },
    data: zTextBlockData.parse({ __v: 1, segments: item.content, dropCap: false }) as unknown as Json,
    displayOrder: 1000,
    visibilityLevel: "players",
    visibilityScopeId: null,
    createdBy: params.userId,
  });

  const nextItems = pageToSharedLink(items, item.id, entity.id);
  const saved = nextItems
    ? await updateBlockContent(supabase, {
        id: tree.id,
        expectedVersion: tree.version,
        display: tree.display,
        data: { __v: 1, items: nextItems },
        visibilityLevel: tree.visibility_level,
        visibilityScopeId: tree.visibility_scope_id,
        changedBy: params.userId,
      })
    : null;
  if (!saved?.ok) {
    // Le cahier a changé entre-temps : la page y est encore, intacte ; la copie partagée ne doit pas rester.
    await abandonSharedNote(supabase, entity.id);
    return { ok: false, reason: saved?.reason ?? "conflict" };
  }
  return { ok: true, entityId: entity.id };
}

/** « Ne plus partager » : le lien `itemId` du cahier de l'appelant redevient privé. Le texte est intact, l'autrice seule le lit. */
export async function unshareNotebookPage(
  supabase: TypedClient,
  params: { worldId: string; userId: string; itemId: string }
): Promise<{ ok: true } | { ok: false; reason: ShareError }> {
  const { items } = await loadNotebookTree(supabase, params);
  const item = items.find((i) => i.id === params.itemId);
  if (!item || item.kind !== "shared_page") return { ok: false, reason: "not_found" };
  return setSharedVisibility(supabase, { entityId: item.targetId, userId: params.userId, shared: false });
}

export interface SharedNoteView {
  entityId: string;
  title: string;
  authorId: string | null;
  /** Le nom du personnage de l'autrice, ou « MJ » ; `null` si elle n'est plus de la campagne. */
  authorName: string | null;
  segments: NarrativeContent;
  updatedAt: string;
}

/**
 * « Partagées à la table » : les pages partagées que le lecteur peut lire
 * (la RLS des blocs fait le tri), plus récentes d'abord. Les segments sont
 * filtrés par leur propre visibilité, et un lien vers une fiche que le
 * lecteur n'a pas découverte arrive sans identifiant (règle absolue 5).
 */
export async function listSharedNotes(supabase: TypedClient, params: { worldId: string; userId: string }): Promise<SharedNoteView[]> {
  const entities = await listEntitiesByKinds(supabase, params.worldId, [SHARED_NOTE_KIND]);
  if (entities.length === 0) return [];
  const [blocks, viewer, admin, campaignId] = await Promise.all([
    listBlocksByTypeForEntities(
      supabase,
      entities.map((e) => e.id),
      "text"
    ),
    buildViewerForWorld(supabase, params.worldId, params.userId),
    isWorldAdmin(supabase, { worldId: params.worldId, userId: params.userId }),
    resolveCampaignId(supabase, params.worldId),
  ]);
  if (blocks.length === 0) return [];

  const notes = blocks.flatMap((block) => {
    const parsed = zTextBlockData.safeParse(block.data);
    if (!parsed.success) {
      console.error("Page partagée illisible, ignorée", block.id, parsed.error.issues);
      return [];
    }
    const label = (block.display as { label?: unknown } | null)?.label;
    // Même filtrage que la fiche joueur (`playerEntityDetail.ts`) : un segment ne suit pas son auteur.
    const aware = parsed.data.segments.map((segment) => ({ ...segment, visibility: { ...segment.visibility, createdBy: null } }));
    const segments: NarrativeContent = filterSegments(aware, viewer).map(({ visibility, ...rest }) => ({
      ...rest,
      visibility: { level: visibility.level, scopeId: visibility.scopeId },
    }));
    return [{ block, title: typeof label === "string" ? label : "(sans titre)", segments }];
  });

  const refIds = [
    ...new Set(notes.flatMap((n) => n.segments.flatMap((s) => s.content.flatMap((node) => (node.t === "ref" && node.kind === "entity" && node.id ? [node.id] : []))))),
  ];
  const [known, roster] = await Promise.all([
    admin ? Promise.resolve(new Set(refIds)) : listPlayerVisibleEntityIds(supabase, params.worldId, refIds, params.userId),
    campaignId ? listJournalRoster(supabase, campaignId) : Promise.resolve([]),
  ]);
  const names = new Map(roster.map((r) => [r.userId, r.name]));

  return notes
    .map(({ block, title, segments }) => ({
      entityId: block.entity_id,
      title,
      authorId: block.created_by,
      authorName: block.created_by ? (names.get(block.created_by) ?? null) : null,
      segments: unlinkUnknownEntityRefs(segments, known),
      updatedAt: block.updated_at,
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
