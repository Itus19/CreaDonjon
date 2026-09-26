import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import type { Viewer } from "@/src/core/visibility";
import type { EntityTreeNode } from "@/src/core/entity-tree/build-tree";
import { getEntityTree } from "@/src/server/services/entities";
import { resolveEntityRefExcerpts } from "@/src/server/services/refPreview";
import { listActiveQuestsForWorld } from "@/src/server/services/quests";
import { listDiscoveredEntityIds } from "@/src/server/services/discoveries";
import { listEntitiesByIds } from "@/src/server/repos/entities";
import type { QuestColumnEntry, WikiColumnGroup } from "@/lib/solo/types";

type TypedClient = SupabaseClient<Database>;

/**
 * V3-D3 — La colonne gauche de l'écran solo : « le monde connu ».
 *
 * **V3-C4 — la colonne wiki du mode solo n'affiche que ce qui est
 * découvert.** Filtre posé ICI, jamais dans `getEntityTree` : cette fonction
 * sert aussi le wiki du MJ et celui d'une campagne classique, hors périmètre
 * de ce ticket. La fiche du joueur lui-même (`playerEntityId`) échappe
 * toujours au filtre — un joueur voit sa propre fiche, découverte ou non.
 * Aucun marqueur visuel (« connu »/« esquisse »/« mentionné ») pour autant :
 * ce ticket filtre la liste, il ne dessine pas encore la distinction entre
 * ses trois niveaux à l'écran — un pas de plus, pas encore demandé.
 */

/** Aplati l'arborescence `part_of` : cette colonne liste, elle n'imbrique pas (l'esquisse ne montrait aucune indentation). */
function flatten(nodes: EntityTreeNode[]): EntityTreeNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children)]);
}

/**
 * Les entrées du wiki visibles par ce joueur, groupées et aplaties, avec un
 * court extrait par fiche (`resolveEntityRefExcerpts`, déjà utilisé pour les
 * cartes au survol d'un lien — même filtrage de visibilité, une requête
 * groupée de plus, jamais une par fiche).
 *
 * Le groupe « Livre de sessions » (`getEntityTree`) est retiré : ce n'est
 * pas le monde connu, c'est le journal — déjà son propre écran.
 */
export async function buildWikiColumn(
  supabase: TypedClient,
  worldId: string,
  userId: string,
  viewer: Viewer,
  kindLabels: Record<string, string>,
  campaignId: string,
  playerEntityId: string
): Promise<WikiColumnGroup[]> {
  const [tree, discoveredIds] = await Promise.all([getEntityTree(supabase, worldId, userId), listDiscoveredEntityIds(supabase, campaignId, userId)]);
  const groups = tree.filter((g) => g.kind !== "session_journal");

  const flatByGroup = groups.map((g) => ({
    kind: g.kind,
    nodes: flatten(g.items).filter((n) => n.id === playerEntityId || discoveredIds.has(n.id)),
  }));
  const allIds = flatByGroup.flatMap((g) => g.nodes.map((n) => n.id));
  const excerpts = await resolveEntityRefExcerpts(supabase, allIds, viewer);

  return flatByGroup
    .filter((g) => g.nodes.length > 0)
    .map((g) => ({
      kind: g.kind,
      label: kindLabels[g.kind] ?? g.kind,
      entries: g.nodes.map((n) => ({ id: n.id, name: n.name, slug: n.slug, excerpt: excerpts.get(n.id) ?? null })),
    }));
}

/**
 * Les quêtes en cours du monde (`listActiveQuestsForWorld`, écrite depuis
 * la V2, jamais appelée) — le donneur est une référence (`BlockReference`),
 * résolue ici seulement pour le cas `entity` : une quête donnée par une
 * entrée de règle est rare, et lui donner un nom demanderait la même
 * machinerie de résolution que `resolveRuleRefPreviews`, hors de portée de
 * ce ticket — son nom est alors simplement omis, jamais deviné.
 */
export async function buildQuestColumn(supabase: TypedClient, worldId: string, viewer: Viewer): Promise<QuestColumnEntry[]> {
  const quests = await listActiveQuestsForWorld(supabase, worldId, viewer);
  if (quests.length === 0) return [];

  const giverEntityIds = quests
    .map((q) => q.data.giver)
    .filter((g): g is Extract<NonNullable<typeof g>, { kind: "entity" }> => g?.kind === "entity")
    .map((g) => g.id);
  const giverNames = new Map((await listEntitiesByIds(supabase, giverEntityIds)).map((e) => [e.id, e.name]));

  return quests.map((q) => ({
    id: q.blockId,
    title: q.label,
    giverName: q.data.giver?.kind === "entity" ? (giverNames.get(q.data.giver.id) ?? null) : null,
    rewardText: q.data.rewards.length > 0 ? q.data.rewards.map((r) => r.text).join(" · ") : null,
    objectives: q.data.objectives.map((o) => ({ id: o.id, text: o.text, done: o.done })),
  }));
}
