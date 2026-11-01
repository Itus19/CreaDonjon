import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import {
  insertAssignment,
  deleteAssignment,
  getAssignmentById,
  getAssignmentByEntityId,
  submitAssignment,
  markValidated,
  listAssignmentsForCampaign,
  listOpenAssignmentsForUser,
  type SessionJournalEntryRow,
  type SessionJournalAssignmentView,
  type WrittenJournalEntry,
} from "@/src/server/repos/sessionJournal";
import { createEntity, updateEntity } from "@/src/server/services/entities";
import { updateBlockContent } from "@/src/server/services/blocks";
import { insertBlock, listBlocksForEntity } from "@/src/server/repos/blocks";
import { getEntityById, softDeleteEntity } from "@/src/server/repos/entities";
import { grantEntityAccess } from "@/src/server/repos/entityGrants";
import { defaultBlockData, defaultBlockDisplay } from "@/src/core/schemas/blocks/registry";
import { zSessionJournalMetaBlockData } from "@/src/core/schemas/blocks/sessionJournalMeta";
import { getCalendar } from "@/src/server/services/worlds";
import { formatGameDate } from "@/src/core/calendar/formatDate";
import { resolvePlayerNames } from "@/src/server/services/scheduling";
import { getCampaignById, listCampaignMembers } from "@/src/server/repos/campaigns";
import { isWorldAdmin } from "@/src/server/services/permissions";
import { getOrOpenSessionForCampaign } from "@/src/server/services/sessions";
import { insertSessionEvent, nextEventSeq } from "@/src/server/repos/sessions";
import { canCancelDevoir, canSubmitDevoir, canValidateDevoir, mentionDevoir, titreProvisoire, type JournalStatus, type MentionDevoir } from "@/src/core/sessionJournal/devoir";
import type { GameDate } from "@/src/core/calendar/types";

type TypedClient = SupabaseClient<Database>;

// `SESSION_JOURNAL_KIND`, `getSessionJournalTreeGroup` et
// `getLatestSessionJournalSlug` vivent dans `sessionJournalTree.ts`
// (V3.1-120) : `entities.ts` en a besoin, et ce fichier importe
// `createEntity` d'`entities.ts`. Reexportes ici.
export { SESSION_JOURNAL_KIND, getLatestSessionJournalSlug, getSessionJournalTreeGroup } from "@/src/server/services/sessionJournalTree";
import { SESSION_JOURNAL_KIND } from "@/src/server/services/sessionJournalTree";

export type { SessionJournalEntryRow, SessionJournalAssignmentView, WrittenJournalEntry };

export interface JournalRosterEntry {
  userId: string;
  /** V3.1-43 : « à qui le tour » ne propose d'office qu'une joueuse ; le MJ reste choisissable. */
  role: "gm" | "player";
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
  const players = members.filter((m) => m.role === "player").map((m) => ({ userId: m.user_id, role: "player" as const, name: namesByUser.get(m.user_id) ?? null }));
  const gms = members.filter((m) => m.role === "gm").map((m) => ({ userId: m.user_id, role: "gm" as const, name: "MJ" }));
  return [...gms, ...players];
}

type GesteDevoir = "assign" | "cancel" | "submit" | "validate";

/**
 * V3.1-43 : chaque geste sur un devoir s'écrit UNE fois dans le journal de
 * la campagne (`session_events`, événement `system`). Le fait nomme
 * l'autrice par son PJ (« MJ » pour un MJ, comme le sélecteur). V3.1-150 :
 * « Devoir fait » s'y écrit au nom de l'autrice, la validation au nom du MJ.
 */
async function journaliserDevoir(
  supabase: TypedClient,
  params: { campaignId: string; action: GesteDevoir; assignmentId: string; assignedTo: string; callerId: string }
): Promise<void> {
  const [sessionId, noms] = await Promise.all([getOrOpenSessionForCampaign(supabase, params.campaignId), resolvePlayerNames(supabase, params.campaignId)]);
  const autrice = noms.get(params.assignedTo) ?? "MJ";
  const faits: Record<GesteDevoir, string> = {
    assign: `Livre de sessions : devoir assigné à ${autrice}.`,
    cancel: `Livre de sessions : devoir de ${autrice} annulé.`,
    submit: `Livre de sessions : ${autrice} a rendu son devoir.`,
    validate: `Livre de sessions : devoir de ${autrice} validé.`,
  };
  const fait = faits[params.action];
  const seq = await nextEventSeq(supabase, sessionId);
  await insertSessionEvent(supabase, {
    sessionId,
    seq,
    kind: "system",
    actor: params.action === "submit" && params.callerId === params.assignedTo ? "player" : "gm",
    actorUserId: params.callerId,
    // `note` : ce que le journal historique affiche (« Système — Livre de sessions : … »).
    payload: { __v: 1, journal_assignment: { action: params.action, assignmentId: params.assignmentId, assignedTo: params.assignedTo }, note: fait, facts: [fait] } as unknown as Json,
  });
}

/** Annule une page à moitié créée. Journalisé si l'annulation échoue elle-même. */
async function abandonnerPage(supabase: TypedClient, entityId: string): Promise<void> {
  try {
    await softDeleteEntity(supabase, entityId);
  } catch (erreur) {
    console.error("Page de devoir abandonnée non supprimée", entityId, erreur);
  }
}

export type AssignResult = { ok: true; assignment: SessionJournalEntryRow } | { ok: false; reason: "not_found" | "forbidden" | "not_member" };

/**
 * Assigner un devoir (V3.1-150, ADR 0071) : la page naît aussitôt, créée
 * par le MJ — fiche `session_journal` non publique, titre provisoire, blocs
 * « Séance » et « Récit », octroi d'édition à l'autrice — puis le devoir
 * `pending` qui la désigne. Le MJ vérifie ici, avant toute écriture, qu'il
 * l'est bien et que l'autrice est de la campagne : l'octroi lui donne
 * l'édition d'une fiche du monde. Une écriture ratée en chemin efface la
 * page à moitié créée.
 */
export async function assignJournalEntry(
  supabase: TypedClient,
  params: { campaignId: string; ingameDate: GameDate; assignedTo: string; createdBy: string }
): Promise<AssignResult> {
  const campaign = await getCampaignById(supabase, params.campaignId);
  if (!campaign) return { ok: false, reason: "not_found" };
  const [admin, roster, calendar] = await Promise.all([
    isWorldAdmin(supabase, { worldId: campaign.world_id, userId: params.createdBy }),
    listJournalRoster(supabase, params.campaignId),
    getCalendar(supabase, campaign.world_id),
  ]);
  if (!admin) return { ok: false, reason: "forbidden" };
  const autrice = roster.find((r) => r.userId === params.assignedTo);
  if (!autrice) return { ok: false, reason: "not_member" };

  const entity = await createEntity(supabase, {
    worldId: campaign.world_id,
    createdBy: params.createdBy,
    name: titreProvisoire(formatGameDate(params.ingameDate, calendar)),
    entityKind: SESSION_JOURNAL_KIND,
    aliases: [],
  });

  try {
    await grantEntityAccess(supabase, { entityId: entity.id, userId: params.assignedTo, grantedBy: params.createdBy });
    await insertBlock(supabase, {
      entityId: entity.id,
      blockType: "session_journal_meta",
      display: defaultBlockDisplay("session_journal_meta", "Séance"),
      data: zSessionJournalMetaBlockData.parse({
        __v: 1,
        ingameDate: params.ingameDate,
        writtenBy: { userId: params.assignedTo, name: autrice.name ?? "?" },
        // Posée au rendu (« Devoir fait »), pas à la naissance de la page.
        writtenAt: null,
        realSession: null,
      }),
      displayOrder: 1000,
      visibilityLevel: "players",
      visibilityScopeId: null,
      createdBy: params.createdBy,
    });
    await insertBlock(supabase, {
      entityId: entity.id,
      blockType: "text",
      display: defaultBlockDisplay("text", "Récit"),
      data: defaultBlockData("text") as Json,
      displayOrder: 2000,
      visibilityLevel: "players",
      visibilityScopeId: null,
      createdBy: params.createdBy,
    });
    const assignment = await insertAssignment(supabase, { ...params, entityId: entity.id });
    await journaliserDevoir(supabase, { campaignId: assignment.campaign_id, action: "assign", assignmentId: assignment.id, assignedTo: assignment.assigned_to, callerId: params.createdBy });
    return { ok: true, assignment };
  } catch (erreur) {
    await abandonnerPage(supabase, entity.id);
    throw erreur;
  }
}

export type CancelResult = { ok: true } | { ok: false; reason: "not_found" | "forbidden" | "already_submitted" };

/**
 * Annule un devoir encore en cours, et efface sa page (suppression douce) :
 * elle n'a jamais été publiée. Un devoir rendu ne s'annule plus (le rendu
 * est définitif). Journalisé seulement s'il a vraiment été effacé.
 */
export async function cancelJournalAssignment(supabase: TypedClient, params: { id: string; campaignId: string; callerId: string }): Promise<CancelResult> {
  const existing = await getAssignmentById(supabase, params.id);
  // Le devoir doit être celui de la campagne de l'adresse.
  if (!existing || existing.campaign_id !== params.campaignId) return { ok: false, reason: "not_found" };
  if (!canCancelDevoir(existing.status)) return { ok: false, reason: "already_submitted" };
  // La RLS réserve l'effacement au MJ : rien d'effacé = refusé.
  const deleted = await deleteAssignment(supabase, params.id);
  if (!deleted) return { ok: false, reason: "forbidden" };
  if (deleted.entity_id) await softDeleteEntity(supabase, deleted.entity_id);
  await journaliserDevoir(supabase, { campaignId: deleted.campaign_id, action: "cancel", assignmentId: deleted.id, assignedTo: deleted.assigned_to, callerId: params.callerId });
  return { ok: true };
}

export async function listJournalAssignments(supabase: TypedClient, campaignId: string): Promise<SessionJournalAssignmentView[]> {
  return listAssignmentsForCampaign(supabase, campaignId);
}

/** Ce que la barre de l'autrice montre sous « Édition » (V3.1-150, piste A). */
export interface MonDevoir {
  mention: MentionDevoir;
  /** Page du devoir dans l'onglet Édition. */
  slug: string;
  dateEnJeu: string;
}

/**
 * Le devoir à montrer dans la barre de l'autrice : le plus récent qui n'est
 * pas encore validé. `null` sinon. Une requête, plus le calendrier quand un
 * devoir existe (pour la date en jeu).
 */
export async function getMyOpenDevoir(supabase: TypedClient, params: { worldId: string; campaignId: string; userId: string }): Promise<MonDevoir | null> {
  const ouverts = await listOpenAssignmentsForUser(supabase, params);
  const devoir = ouverts.find((d) => d.entity_slug !== null);
  if (!devoir || !devoir.entity_slug) return null;
  const mention = mentionDevoir(devoir.status);
  if (!mention) return null;
  const calendar = await getCalendar(supabase, params.worldId);
  return { mention, slug: devoir.entity_slug, dateEnJeu: formatGameDate(devoir.ingame_date, calendar) };
}

/** Le bandeau d'une page de devoir, pour son autrice seulement ; `null` ailleurs. */
export interface BandeauDevoir {
  id: string;
  /** Validé : plus de bandeau. */
  status: Exclude<JournalStatus, "validated">;
  dateEnJeu: string;
  writtenAt: string | null;
}

export async function getDevoirBandeau(supabase: TypedClient, params: { worldId: string; entityId: string; userId: string }): Promise<BandeauDevoir | null> {
  const devoir = await getAssignmentByEntityId(supabase, params.entityId);
  if (!devoir || devoir.assigned_to !== params.userId) return null;
  const status = devoir.status;
  if (status === "validated") return null;
  const calendar = await getCalendar(supabase, params.worldId);
  return { id: devoir.id, status, dateEnJeu: formatGameDate(devoir.ingame_date, calendar), writtenAt: devoir.written_at };
}

/**
 * Une page du Livre encore en brouillon est-elle cachée à ce lecteur ?
 * (V3.1-150) Oui pour tout le monde sauf l'autrice et le MJ — la lecture
 * directe d'une fiche dans le wiki joueur répond alors « introuvable ».
 */
export async function isJournalDraftHiddenFrom(supabase: TypedClient, params: { worldId: string; entityId: string; userId: string }): Promise<boolean> {
  const devoir = await getAssignmentByEntityId(supabase, params.entityId);
  if (!devoir || devoir.status !== "pending" || devoir.assigned_to === params.userId) return false;
  return !(await isWorldAdmin(supabase, { worldId: params.worldId, userId: params.userId }));
}

export type SubmitResult = { ok: true; slug: string } | { ok: false; reason: "not_found" | "forbidden" | "already_submitted" | "conflict" };

/**
 * « Devoir fait » (V3.1-150) : définitif. Dans cet ordre, pour qu'un échec
 * laisse le devoir à rendre plutôt qu'à moitié publié :
 * 1. la page devient publique (l'autrice a l'octroi : service ordinaire,
 *    révision tracée) ;
 * 2. la date de rédaction se pose dans le bloc « Séance » ;
 * 3. le devoir passe à `written` par `submit_journal_assignment` — la
 *    seule écriture de l'autrice sur son devoir ;
 * 4. le fait s'écrit au journal de la campagne.
 */
export async function submitMyJournalAssignment(supabase: TypedClient, params: { assignmentId: string; userId: string }): Promise<SubmitResult> {
  const devoir = await getAssignmentById(supabase, params.assignmentId);
  if (!devoir) return { ok: false, reason: "not_found" };
  if (devoir.assigned_to !== params.userId) return { ok: false, reason: "forbidden" };
  if (!canSubmitDevoir({ status: devoir.status, assignedTo: devoir.assigned_to, entityId: devoir.entity_id }, params.userId) || !devoir.entity_id) {
    return { ok: false, reason: "already_submitted" };
  }
  const entity = await getEntityById(supabase, devoir.entity_id);
  if (!entity) return { ok: false, reason: "not_found" };

  if (!entity.is_public) {
    const publiee = await updateEntity(supabase, {
      id: entity.id,
      changedBy: params.userId,
      expectedVersion: entity.version,
      name: entity.name,
      entityKind: entity.entity_kind,
      aliases: entity.aliases,
      isPublic: true,
    });
    if (!publiee.ok) return { ok: false, reason: publiee.reason === "conflict" ? "conflict" : "forbidden" };
  }

  const meta = (await listBlocksForEntity(supabase, entity.id)).find((b) => b.block_type === "session_journal_meta");
  if (meta) {
    const data = zSessionJournalMetaBlockData.parse(meta.data);
    const datee = await updateBlockContent(supabase, {
      id: meta.id,
      expectedVersion: meta.version,
      display: meta.display,
      data: { ...data, writtenAt: new Date().toISOString() },
      visibilityLevel: meta.visibility_level,
      visibilityScopeId: meta.visibility_scope_id,
      changedBy: params.userId,
    });
    if (!datee.ok) return { ok: false, reason: datee.reason === "conflict" ? "conflict" : "forbidden" };
  }

  if (!(await submitAssignment(supabase, devoir.id))) return { ok: false, reason: "already_submitted" };
  await journaliserDevoir(supabase, { campaignId: devoir.campaign_id, action: "submit", assignmentId: devoir.id, assignedTo: devoir.assigned_to, callerId: params.userId });
  return { ok: true, slug: entity.slug };
}

export type ValidateResult = { ok: true } | { ok: false; reason: "not_found" | "forbidden" | "not_submitted" };

/** Le MJ valide un devoir rendu (V3.1-150) : la mention quitte la barre de l'autrice. */
export async function validateJournalAssignment(
  supabase: TypedClient,
  params: { campaignId: string; assignmentId: string; callerId: string }
): Promise<ValidateResult> {
  const [campaign, devoir] = await Promise.all([getCampaignById(supabase, params.campaignId), getAssignmentById(supabase, params.assignmentId)]);
  if (!campaign) return { ok: false, reason: "not_found" };
  // Refusé avant introuvable : un non-MJ n'apprend rien du devoir visé.
  if (!(await isWorldAdmin(supabase, { worldId: campaign.world_id, userId: params.callerId }))) return { ok: false, reason: "forbidden" };
  if (!devoir || devoir.campaign_id !== campaign.id) return { ok: false, reason: "not_found" };
  if (!canValidateDevoir(devoir.status)) return { ok: false, reason: "not_submitted" };
  const valide = await markValidated(supabase, devoir.id);
  if (!valide) return { ok: false, reason: "not_submitted" };
  await journaliserDevoir(supabase, { campaignId: devoir.campaign_id, action: "validate", assignmentId: devoir.id, assignedTo: devoir.assigned_to, callerId: params.callerId });
  return { ok: true };
}
