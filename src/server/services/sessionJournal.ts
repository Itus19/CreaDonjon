import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import {
  insertAssignment,
  deleteAssignment,
  getAssignmentById,
  markWritten,
  listAssignmentsForCampaign,
  listPendingAssignmentsForUser,
  listWrittenEntriesForWorld,
  claimJournalEntryGrant,
  type SessionJournalEntryRow,
  type WrittenJournalEntry,
} from "@/src/server/repos/sessionJournal";
import { createEntity } from "@/src/server/services/entities";
import { insertBlock } from "@/src/server/repos/blocks";
import { defaultBlockData, defaultBlockDisplay } from "@/src/core/schemas/blocks/registry";
import { zSessionJournalMetaBlockData } from "@/src/core/schemas/blocks/sessionJournalMeta";
import { getCalendar } from "@/src/server/services/worlds";
import { formatGameDate } from "@/src/core/calendar/formatDate";
import { resolvePlayerNames } from "@/src/server/services/scheduling";
import { listCampaignMembers } from "@/src/server/repos/campaigns";
import type { GameDate } from "@/src/core/calendar/types";
import type { EntityTreeGroup } from "@/src/core/entity-tree/build-tree";

type TypedClient = SupabaseClient<Database>;

/** Entity_kind dedie (V2.1-3) — chaque entree du Livre de sessions est une vraie fiche, jamais un ecran a part (voir la migration 20260913160000 pour le detail de la table qui porte le devoir/la date ingame). */
export const SESSION_JOURNAL_KIND = "session_journal";

export type { SessionJournalEntryRow, WrittenJournalEntry };

export interface JournalRosterEntry {
  userId: string;
  /** Nom du PJ (`null` si ce compte n'a pas encore de PJ dans cette campagne) — même identité que partout ailleurs dans l'app, jamais un nom de compte. */
  name: string | null;
}

/**
 * Autrices possibles d'une entree du Livre de sessions — toute joueuse (y
 * compris sans PC encore, le MJ choisit avant que la fiche existe) ET tout
 * MJ de la campagne (retour utilisateur : "je dois pouvoir me l'attribuer
 * à moi-même (MJ)... nom des joueurs et juste MJ pour le MJ"). Le MJ n'a
 * normalement aucun PJ dans `campaign_characters`, d'où le libellé fixe
 * plutôt qu'une résolution par personnage comme pour les joueuses.
 * Reutilisee telle quelle par le selecteur d'assignation ET par le champ
 * "Rédigé par" du bloc `session_journal_meta` — memes candidats exacts.
 */
export async function listJournalRoster(supabase: TypedClient, campaignId: string): Promise<JournalRosterEntry[]> {
  const [members, namesByUser] = await Promise.all([listCampaignMembers(supabase, campaignId), resolvePlayerNames(supabase, campaignId)]);
  const players = members.filter((m) => m.role === "player").map((m) => ({ userId: m.user_id, name: namesByUser.get(m.user_id) ?? null }));
  const gms = members.filter((m) => m.role === "gm").map((m) => ({ userId: m.user_id, name: "MJ" }));
  return [...gms, ...players];
}

export async function assignJournalEntry(
  supabase: TypedClient,
  params: { campaignId: string; ingameDate: GameDate; assignedTo: string; createdBy: string }
): Promise<SessionJournalEntryRow> {
  return insertAssignment(supabase, params);
}

export async function cancelJournalAssignment(supabase: TypedClient, id: string): Promise<void> {
  await deleteAssignment(supabase, id);
}

export async function listJournalAssignments(supabase: TypedClient, campaignId: string): Promise<SessionJournalEntryRow[]> {
  return listAssignmentsForCampaign(supabase, campaignId);
}

/** Devoir en attente de ce compte pour cette campagne (retour utilisateur : bannière côté joueuse) — au plus un a la fois n'est pas impose par le schema, mais le premier suffit a l'affichage. */
export async function getMyPendingJournalAssignment(
  supabase: TypedClient,
  params: { campaignId: string; userId: string }
): Promise<SessionJournalEntryRow | null> {
  const rows = await listPendingAssignmentsForUser(supabase, params);
  return rows[0] ?? null;
}

/** Meme devoir que ci-dessus, avec la date ingame deja formatee (retour utilisateur : bannière) — evite au client de porter le calendrier du monde juste pour un libelle. */
export async function getMyPendingJournalAssignmentLabel(
  supabase: TypedClient,
  params: { worldId: string; campaignId: string; userId: string }
): Promise<{ id: string; ingameDateLabel: string } | null> {
  const assignment = await getMyPendingJournalAssignment(supabase, params);
  if (!assignment) return null;
  const calendar = await getCalendar(supabase, params.worldId);
  return { id: assignment.id, ingameDateLabel: formatGameDate(assignment.ingame_date, calendar) };
}

/**
 * L'autrice commence a ecrire (retour utilisateur : le devoir devient une
 * vraie fiche) : cree l'entite `session_journal` + un bloc
 * `session_journal_meta` (les quatre champs fixes — date ingame, autrice,
 * date IRL de redaction, seance reelle) + un bloc `text` vide pret a
 * rediger, puis marque le devoir redige. Renvoie le slug pour rediriger
 * vers l'edition NORMALE de la fiche (memes blocs "+ Ajouter" que partout
 * ailleurs).
 */
export async function submitJournalEntry(
  supabase: TypedClient,
  params: { assignment: SessionJournalEntryRow; worldId: string; userId: string; title: string }
): Promise<{ slug: string }> {
  const roster = await listJournalRoster(supabase, params.assignment.campaign_id);
  // Retour utilisateur : "je dois pouvoir me l'attribuer à moi-même (MJ)" —
  // le MJ n'a normalement pas de PJ dans cette campagne, jamais de nom via
  // `listJournalRoster` sinon son libelle fixe "MJ" (voir ce service).
  const authorName = roster.find((r) => r.userId === params.userId)?.name ?? "?";
  const entity = await createEntity(supabase, {
    worldId: params.worldId,
    createdBy: params.userId,
    name: params.title,
    entityKind: SESSION_JOURNAL_KIND,
    aliases: [],
  });

  // V2.1-15 : AVANT les blocs, jamais apres — `blocks_insert` appelle
  // `app.can_edit_entity`, qui ne connait plus de cas propre au Livre de
  // sessions. Sans cet octroi, l'autrice creerait sa fiche puis echouerait a
  // y poser une seule ligne.
  const granted = await claimJournalEntryGrant(supabase, { assignmentId: params.assignment.id, entityId: entity.id });
  if (!granted) throw new Error("L'octroi d'edition n'a pas pu etre pose sur cette entree.");

  await insertBlock(supabase, {
    entityId: entity.id,
    blockType: "session_journal_meta",
    display: defaultBlockDisplay("session_journal_meta", "Séance"),
    data: zSessionJournalMetaBlockData.parse({
      __v: 1,
      ingameDate: params.assignment.ingame_date,
      writtenBy: { userId: params.userId, name: authorName },
      writtenAt: new Date().toISOString(),
      realSession: null,
    }),
    displayOrder: 1000,
    visibilityLevel: "players",
    visibilityScopeId: null,
    createdBy: params.userId,
  });
  await insertBlock(supabase, {
    entityId: entity.id,
    blockType: "text",
    display: defaultBlockDisplay("text", "Récit"),
    data: defaultBlockData("text") as Json,
    displayOrder: 2000,
    visibilityLevel: "players",
    visibilityScopeId: null,
    createdBy: params.userId,
  });

  await markWritten(supabase, { id: params.assignment.id, entityId: entity.id });
  return { slug: entity.slug };
}

/**
 * Point d'entree route (V2.1-3) : verifie que ce devoir precis appartient
 * bien a ce compte et est toujours en attente AVANT de creer quoi que ce
 * soit — la RLS de `session_journal_entries` bloquerait deja une
 * reassignation frauduleuse au moment du `markWritten`, mais creer une
 * fiche puis echouer a l'attacher laisserait une fiche orpheline (PDD §28,
 * verifier cote service plutot que compter sur le filet RLS seul).
 */
export async function submitMyJournalEntry(
  supabase: TypedClient,
  params: { assignmentId: string; worldId: string; userId: string; title: string }
): Promise<{ slug: string } | { error: string }> {
  const assignment = await getAssignmentById(supabase, params.assignmentId);
  if (!assignment || assignment.assigned_to !== params.userId) {
    return { error: "Ce devoir ne vous est pas assigné." };
  }
  if (assignment.status !== "pending") {
    return { error: "Ce devoir a déjà été rédigé." };
  }
  return submitJournalEntry(supabase, { assignment, worldId: params.worldId, userId: params.userId, title: params.title });
}

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
