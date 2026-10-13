import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { listWrittenEntriesForWorld } from "@/src/server/repos/sessionJournal";
import type { EntityTreeGroup } from "@/src/core/entity-tree/build-tree";

/**
 * Module feuille (V3.1-120) : il n'importe aucun service. Ce que l'arbre
 * du wiki lit du Livre de sessions, sorti de `sessionJournal.ts` (qui le
 * reexporte) pour qu'`entities.ts` le lise sans former de cycle avec
 * `sessionJournal.ts`, qui importe `createEntity`.
 */

type TypedClient = SupabaseClient<Database>;

/** Entity_kind dedie (V2.1-3) — chaque entree du Livre de sessions est une vraie fiche, jamais un ecran a part (voir la migration 20260913160000 pour le detail de la table qui porte le devoir/la date ingame). */
export const SESSION_JOURNAL_KIND = "session_journal";

/**
 * Groupe epingle du sommaire (retour utilisateur : "Livre de sessions" en
 * tout premier, meme presentation que les autres fiches, titres tries par
 * date IRL de redaction decroissante) — l'appelant (`getEntityTree`/
 * `getPublicEntityTree`) le prepend au resultat de `buildEntityTree`, apres
 * en avoir retire ce kind (jamais un groupe alphabetique en plus de
 * celui-ci). `publicOnly` filtre aux fiches `is_public` (apercu/partage).
 */
export async function getSessionJournalTreeGroup(
  supabase: TypedClient,
  worldId: string,
  opts: { publicOnly: boolean } = { publicOnly: false }
): Promise<EntityTreeGroup | null> {
  const entries = await listWrittenEntriesForWorld(supabase, worldId);
  const visible = opts.publicOnly ? entries.filter((e) => e.isPublic) : entries;
  if (visible.length === 0) return null;
  return {
    kind: SESSION_JOURNAL_KIND,
    items: visible.map((e, i) => ({ id: e.entityId, name: e.name, slug: e.slug, displayOrder: i, version: 1, children: [] })),
  };
}

/** Slug de l'entree la plus recente (retour utilisateur : "le wiki public s'ouvre toujours sur la page la plus récente") — `null` tant qu'aucune entree n'est redigee, l'appelant retombe alors sur l'ecran d'accueil habituel. */
export async function getLatestSessionJournalSlug(
  supabase: TypedClient,
  worldId: string,
  opts: { publicOnly: boolean } = { publicOnly: false }
): Promise<string | null> {
  const entries = await listWrittenEntriesForWorld(supabase, worldId);
  const visible = opts.publicOnly ? entries.filter((e) => e.isPublic) : entries;
  return visible[0]?.slug ?? null;
}
