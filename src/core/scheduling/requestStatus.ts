import { expectedAtTable } from "./bestWindow";

/**
 * V3.1-190 — l'état d'une demande de disponibilités, pour les cartes de
 * l'écran et les pastilles : qui est attendu, qui a répondu, qui manque, et
 * si elle est « prête à fixer » (tout le monde a répondu).
 *
 * Répondre, c'est avoir coché au moins une date, ou avoir dit « aucune date
 * ne me va » (`availability_declines`). Mêmes personnes attendues que le
 * décompte de la grille (`expectedAtTable`).
 */
export interface RequestSummary {
  expected: string[];
  responded: string[];
  missing: string[];
  ready: boolean;
}

export function summarizeRequest(params: {
  members: readonly { user_id: string; role: string }[];
  creatorId: string;
  availabilityUserIds: readonly string[];
  declinedUserIds: readonly string[];
}): RequestSummary {
  const respondedSet = new Set([...params.availabilityUserIds, ...params.declinedUserIds]);
  const expected = expectedAtTable(params.members, params.creatorId, [...respondedSet]).sort();
  const responded = expected.filter((id) => respondedSet.has(id));
  const missing = expected.filter((id) => !respondedSet.has(id));
  return { expected, responded, missing, ready: expected.length > 0 && missing.length === 0 };
}

/** Le nombre de demandes qui attendent la réponse de ce compte — la pastille du rail joueur. */
export function unansweredCount(summaries: readonly RequestSummary[], userId: string): number {
  return summaries.filter((s) => s.missing.includes(userId)).length;
}
