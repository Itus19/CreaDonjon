import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import {
  getDisplayNamesForUsers,
  listEntityRevisionsForEntities,
  listEntityRevisionsForWorld,
  listSessionEventsForWorld,
  type EntityRevisionJournalRow,
  type SessionEventJournalRow,
} from "@/src/server/repos/activityJournal";
import { listPcEntityIdsForWorld } from "@/src/server/repos/campaigns";
import { listEntitiesByIds } from "@/src/server/repos/entities";
import { listRevisionSnapshotsInRange } from "@/src/server/repos/entityRevisions";
import { normalizeStoredSnapshot } from "@/src/server/services/entityHistory";
import { diffEntitySnapshots } from "@/src/core/history/diff";

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

const ENTITY_FIELD_LABELS_FR: Record<string, string> = {
  name: "nom",
  entityKind: "type",
  aliases: "alias",
};

export interface JournalEntry {
  source: "wiki" | "jeu";
  label: string;
  accountName: string;
  createdAt: string;
  /** `null` si l'evenement ne reference aucune fiche (la plupart des `combat`/`narration`/`roll`) — sinon la fiche concernee. */
  entitySlug: string | null;
  entityName: string | null;
  /** V2 (retour utilisateur) : quel bloc (ou quel champ de la fiche) a change, pour une entree "wiki" — `null` pour la toute premiere revision (rien a comparer) ou pour une entree "jeu" (le detail vit dans `label` via `payload.note`, voir ci-dessous). */
  blockLabel: string | null;
}

/** Certains `session_events` (ex. `world_update`, quand une case a cocher touche un bloc de quete lie a une fiche) portent un `entity_id` de premier niveau dans leur payload — jamais interprete plus finement (`combat` imbrique le sien dans before/after, sans rapport avec une fiche du wiki). */
function extractEventEntityId(payload: unknown): string | null {
  if (payload && typeof payload === "object" && "entity_id" in payload) {
    const value = (payload as Record<string, unknown>).entity_id;
    return typeof value === "string" ? value : null;
  }
  return null;
}

/** La plupart des `session_events` portent un `note` deja redige en francais (ex. "Dégâts subis : 8", "CA +1") — c'est deja le detail "avant -> apres" pour les evenements de jeu, jamais reconstruit ici a partir de before/after (dont la forme varie par `kind`). */
function extractEventNote(payload: unknown): string | null {
  if (payload && typeof payload === "object" && "note" in payload) {
    const value = (payload as Record<string, unknown>).note;
    return typeof value === "string" && value.trim() !== "" ? value : null;
  }
  return null;
}

/**
 * Quel(s) bloc(s) (ou quel champ de la fiche) ont change entre la revision
 * precedente et chacune des revisions listees (retour utilisateur : "le type
 * de bloc qui a ete modifie"). Une requete par entite distincte du lot
 * (`listRevisionSnapshotsInRange`, une seule plage couvrant tout le lot),
 * jamais une par revision. Cle du resultat : `${entity_id}:${revision_number}`.
 *
 * S'arrete au bloc/champ modifie — jamais la valeur avant/apres a
 * l'interieur d'un bloc (stats, quantites...) : `diffEntitySnapshots` ne
 * compare que des blocs entiers (SCHEMA.md §15, un instantane est un
 * snapshot complet, pas un diff par champ). Une vraie comparaison "10 PV ->
 * 8 PV" a l'interieur d'un bloc demanderait un differ propre a chaque type
 * de bloc — hors de portee de ce journal, a discuter comme un ticket a part.
 */
async function computeBlockLabels(supabase: TypedClient, revisions: EntityRevisionJournalRow[]): Promise<Map<string, string>> {
  const byEntity = new Map<string, number[]>();
  for (const r of revisions) {
    const list = byEntity.get(r.entity_id) ?? [];
    list.push(r.revision_number);
    byEntity.set(r.entity_id, list);
  }

  const result = new Map<string, string>();
  await Promise.all(
    [...byEntity.entries()].map(async ([entityId, numbers]) => {
      const min = Math.min(...numbers);
      const max = Math.max(...numbers);
      const rows = await listRevisionSnapshotsInRange(supabase, entityId, min - 1, max);
      const snapshotByNumber = new Map(rows.map((row) => [row.revision_number, normalizeStoredSnapshot(row.snapshot as Json)]));

      for (const n of numbers) {
        const prev = snapshotByNumber.get(n - 1);
        const curr = snapshotByNumber.get(n);
        if (!prev || !curr) continue;
        const diff = diffEntitySnapshots(prev, curr);
        const blockLabels = diff.blocks.map((b) => b.label || b.blockType);
        const fieldLabels = diff.entityChanges.map((c) => ENTITY_FIELD_LABELS_FR[c.field] ?? c.field);
        const labels = [...blockLabels, ...fieldLabels];
        if (labels.length > 0) {
          result.set(`${entityId}:${n}`, [...new Set(labels)].join(", "));
        }
      }
    })
  );
  return result;
}

/**
 * `allowedEventEntityIds` : `null` pour la vue MJ (aucune restriction) ou un
 * ensemble d'id pour la vue joueur — meme fiches PJ que celles utilisees pour
 * filtrer les revisions (`getPlayerJournalForWorld`), jamais un evenement de
 * jeu ne doit reveler une fiche que le joueur ne pourrait pas deja voir cote
 * wiki.
 */
async function mergeJournal(
  supabase: TypedClient,
  revisions: EntityRevisionJournalRow[],
  events: SessionEventJournalRow[],
  allowedEventEntityIds: Set<string> | null
): Promise<JournalEntry[]> {
  const accountIds = [
    ...revisions.map((r) => r.changed_by).filter((id): id is string => id !== null),
    ...events.map((e) => e.actor_user_id).filter((id): id is string => id !== null),
  ];
  const [namesByAccount, blockLabels] = await Promise.all([
    getDisplayNamesForUsers(supabase, accountIds),
    computeBlockLabels(supabase, revisions),
  ]);
  const nameFor = (id: string | null) => (id ? (namesByAccount.get(id) || "Compte sans nom") : "IA / système");

  const revisionEntries: JournalEntry[] = revisions.map((r) => ({
    source: "wiki",
    label: `Révision #${r.revision_number} (${r.change_source === "ai" ? "proposée par l'IA" : "manuelle"})`,
    accountName: nameFor(r.changed_by),
    createdAt: r.created_at,
    entitySlug: r.entity_slug,
    entityName: r.entity_name,
    blockLabel: blockLabels.get(`${r.entity_id}:${r.revision_number}`) ?? null,
  }));

  const eventEntityIds = events
    .map((e) => extractEventEntityId(e.payload))
    .filter((id): id is string => id !== null && (allowedEventEntityIds === null || allowedEventEntityIds.has(id)));
  const eventEntities = await listEntitiesByIds(supabase, [...new Set(eventEntityIds)]);
  const eventEntityById = new Map(eventEntities.map((e) => [e.id, e]));

  const eventEntries: JournalEntry[] = events.map((e) => {
    const rawEntityId = extractEventEntityId(e.payload);
    const entity =
      rawEntityId && (allowedEventEntityIds === null || allowedEventEntityIds.has(rawEntityId))
        ? eventEntityById.get(rawEntityId)
        : undefined;
    const note = extractEventNote(e.payload);
    const baseLabel = SESSION_EVENT_LABELS_FR[e.kind] ?? e.kind;
    return {
      source: "jeu",
      label: note ? `${baseLabel} — ${note}` : baseLabel,
      accountName: nameFor(e.actor_user_id),
      createdAt: e.created_at,
      entitySlug: entity?.slug ?? null,
      entityName: entity?.name ?? null,
      blockLabel: null,
    };
  });

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
  return mergeJournal(supabase, revisions, events, null);
}

/**
 * Variante cote joueur (retour utilisateur, ecran d'accueil 3 colonnes) :
 * memes evenements de jeu (une seule campagne par monde, V2-G1 — rien a
 * filtrer de plus que ce que `session_events_select` autorise deja), mais
 * les revisions ET la resolution de fiche des evenements sont restreintes
 * aux fiches PJ de la campagne (`listPcEntityIdsForWorld`) — jamais les
 * PNJ/lieux du MJ, qui pourraient reveler un secret pas encore decouvert.
 * Correspond a l'intention d'origine du suivi en direct
 * (specs/module-joueur-et-solo.md §A3 : "le MJ voit les modifications des
 * fiches PJ"), ici cote joueur.
 */
export async function getPlayerJournalForWorld(supabase: TypedClient, worldId: string): Promise<JournalEntry[]> {
  const pcEntityIds = await listPcEntityIdsForWorld(supabase, worldId);
  const [revisions, events] = await Promise.all([
    listEntityRevisionsForEntities(supabase, pcEntityIds),
    listSessionEventsForWorld(supabase, worldId),
  ]);
  return mergeJournal(supabase, revisions, events, new Set(pcEntityIds));
}
