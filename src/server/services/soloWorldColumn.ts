import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import type { Viewer } from "@/src/core/visibility";
import type { EntityTreeNode } from "@/src/core/entity-tree/build-tree";
import { getEntityTree } from "@/src/server/services/entities";
import { resolveEntityRefExcerpts } from "@/src/server/services/refPreview";
import { listActiveQuestsForWorld } from "@/src/server/services/quests";
import { listEntitiesByIds } from "@/src/server/repos/entities";
import type { QuestColumnEntry, WikiColumnGroup } from "@/lib/solo/types";

type TypedClient = SupabaseClient<Database>;

/**
 * V3-D3 — La colonne gauche de l'écran solo : « le monde connu ».
 *
 * **Ce que ce ticket NE fait PAS, et pourquoi.** Le critère « un marqueur
 * de découverte sur chaque entrée » (connu/esquisse/mentionné) suppose deux
 * briques qui n'existent pas encore : `entity_discoveries` n'a jamais été
 * écrite (V3-C4), et une « esquisse » — un PNJ apparu en jouant sans fiche —
 * n'a pas de représentation dans le modèle avant V3-C2. Faute de données
 * réelles, aucun marqueur n'est affiché ici plutôt que d'en inventer un —
 * même principe que la météo omise en V3-D2. Cette colonne réutilise donc
 * la visibilité déjà en place pour l'onglet Wiki joueur (`listEntitiesByIds`
 * dans le monde entier) — RIEN DE PLUS que ce qu'un joueur peut déjà
 * ouvrir depuis `/joueur/wiki` aujourd'hui, jamais moins non plus.
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
  kindLabels: Record<string, string>
): Promise<WikiColumnGroup[]> {
  const tree = await getEntityTree(supabase, worldId, userId);
  const groups = tree.filter((g) => g.kind !== "session_journal");

  const flatByGroup = groups.map((g) => ({ kind: g.kind, nodes: flatten(g.items) }));
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
