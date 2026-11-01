/**
 * Le devoir de journal (V3.1-150, ADR 0071) : ses états et qui peut quoi.
 * Fonctions pures ; la base les applique aussi (RLS et
 * `submit_journal_assignment`), le serveur les lit avant d'écrire pour
 * répondre clairement plutôt que de compter sur un refus muet.
 *
 * `pending` : la page existe, l'autrice l'écrit, personne d'autre ne la voit.
 * `written` : « Devoir fait » — la page est publique et dans le Livre. Définitif.
 * `validated` : le MJ a validé ; la mention quitte la barre de l'autrice.
 */
export const JOURNAL_STATUSES = ["pending", "written", "validated"] as const;
export type JournalStatus = (typeof JOURNAL_STATUSES)[number];

/** La colonne est un `text` contraint en base : une autre valeur est un défaut, pas un état à deviner. */
export function parseJournalStatus(value: string): JournalStatus {
  const found = JOURNAL_STATUSES.find((s) => s === value);
  if (!found) throw new Error(`État de devoir inconnu : ${JSON.stringify(value)}`);
  return found;
}

/** Dans le Livre, pour toute la table. */
export function isPublishedStatus(status: JournalStatus): boolean {
  return status !== "pending";
}

export interface DevoirPourRendu {
  status: JournalStatus;
  assignedTo: string;
  entityId: string | null;
}

/** « Devoir fait » : l'autrice seule, une seule fois, et seulement si la page existe. */
export function canSubmitDevoir(devoir: DevoirPourRendu, userId: string): boolean {
  return devoir.status === "pending" && devoir.assignedTo === userId && devoir.entityId !== null;
}

/** Le MJ valide un devoir rendu (le droit de MJ, lui, est vérifié par le serveur et la RLS). */
export function canValidateDevoir(status: JournalStatus): boolean {
  return status === "written";
}

/** Le rendu est définitif : on n'annule qu'un devoir encore en cours. */
export function canCancelDevoir(status: JournalStatus): boolean {
  return status === "pending";
}

export type MentionDevoir = "a_rendre" | "rendu";

/** Ce que la barre de l'autrice affiche sous « Édition » ; `null` : rien, le devoir est validé. */
export function mentionDevoir(status: JournalStatus): MentionDevoir | null {
  if (status === "pending") return "a_rendre";
  if (status === "written") return "rendu";
  return null;
}

/** Le titre que la page reçoit à sa naissance ; l'autrice le change librement. */
export function titreProvisoire(dateEnJeu: string): string {
  const date = dateEnJeu.trim();
  return date ? `Journal · ${date}` : "Journal";
}
