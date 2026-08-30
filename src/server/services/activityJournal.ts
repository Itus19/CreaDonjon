import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import {
  getDisplayNamesForUsers,
  listEntityRevisionsForEntities,
  listEntityRevisionsForWorld,
  listSessionEventsForWorld,
  type EntityRevisionJournalRow,
  type SessionEventJournalRow,
} from "@/src/server/repos/activityJournal";
import { listPcEntityIdsForWorld } from "@/src/server/repos/campaigns";

type TypedClient = SupabaseClient<Database>;

const SESSION_EVENT_LABELS_FR: Record<string, string> = {
  player_action: "Action de joueur",
  narration: "Narration",
  roll: "Jet de dés",
  rule_application: "Application de règle",
  world_update: "Mise à jour du monde",
  note: "Note",
  system: "Système",
};

export interface JournalEntry {
  source: "wiki" | "jeu";
  label: string;
  accountName: string;
  createdAt: string;
  /** `null` pour un evenement de jeu (pas de fiche precise) — sinon la fiche concernee. */
  entitySlug: string | null;
  entityName: string | null;
}

async function mergeJournal(
  supabase: TypedClient,
  revisions: EntityRevisionJournalRow[],
  events: SessionEventJournalRow[]
): Promise<JournalEntry[]> {
  const accountIds = [
    ...revisions.map((r) => r.changed_by).filter((id): id is string => id !== null),
    ...events.map((e) => e.actor_user_id).filter((id): id is string => id !== null),
  ];
  const namesByAccount = await getDisplayNamesForUsers(supabase, accountIds);
  const nameFor = (id: string | null) => (id ? (namesByAccount.get(id) || "Compte sans nom") : "IA / système");

  const revisionEntries: JournalEntry[] = revisions.map((r) => ({
    source: "wiki",
    label: `Révision #${r.revision_number} (${r.change_source === "ai" ? "proposée par l'IA" : "manuelle"})`,
    accountName: nameFor(r.changed_by),
    createdAt: r.created_at,
    entitySlug: r.entity_slug,
    entityName: r.entity_name,
  }));

  const eventEntries: JournalEntry[] = events.map((e) => ({
    source: "jeu",
    label: SESSION_EVENT_LABELS_FR[e.kind] ?? e.kind,
    accountName: nameFor(e.actor_user_id),
    createdAt: e.created_at,
    entitySlug: null,
    entityName: null,
  }));

  return [...revisionEntries, ...eventEntries].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/**
 * Journal fusionne (V2-M6/M7) : `entity_revisions` (edition redactionnelle)
 * et `session_events` (mutation de jeu) sont deux canaux distincts depuis V1
 * (specs/module-joueur-et-solo.md §A3, jamais confondus) — fusionnes ici
 * uniquement pour l'AFFICHAGE, tries par date, chaque ligne indiquant sa
 * source. Vue complete, jamais filtree — reservee au MJ/superadmin (verifie
 * par l'appelant), voir `getPlayerJournalForWorld` pour la vue joueur.
 */
export async function getMergedJournalForWorld(supabase: TypedClient, worldId: string): Promise<JournalEntry[]> {
  const [revisions, events] = await Promise.all([
    listEntityRevisionsForWorld(supabase, worldId),
    listSessionEventsForWorld(supabase, worldId),
  ]);
  return mergeJournal(supabase, revisions, events);
}

/**
 * Variante cote joueur (retour utilisateur, ecran d'accueil 3 colonnes) :
 * memes evenements de jeu (une seule campagne par monde, V2-G1 — rien a
 * filtrer de plus que ce que `session_events_select` autorise deja), mais
 * les revisions sont restreintes aux fiches PJ de la campagne
 * (`listPcEntityIdsForWorld`) — jamais les PNJ/lieux du MJ, qui pourraient
 * reveler un secret pas encore decouvert. Correspond a l'intention
 * d'origine du suivi en direct (specs/module-joueur-et-solo.md §A3 : "le MJ
 * voit les modifications des fiches PJ"), ici cote joueur.
 */
export async function getPlayerJournalForWorld(supabase: TypedClient, worldId: string): Promise<JournalEntry[]> {
  const pcEntityIds = await listPcEntityIdsForWorld(supabase, worldId);
  const [revisions, events] = await Promise.all([
    listEntityRevisionsForEntities(supabase, pcEntityIds),
    listSessionEventsForWorld(supabase, worldId),
  ]);
  return mergeJournal(supabase, revisions, events);
}
