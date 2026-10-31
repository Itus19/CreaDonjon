import type { CombatParticipantRow, CombatRow } from "@/src/server/repos/combats";
import type { CombatDetail, ParticipantCharacteristics } from "@/src/server/services/combats";
import type { PlayerTargetedRollInput, TargetedRollInput } from "@/lib/combats/schemas";
import type { ReponseJetCible } from "@/lib/ui/initiative";

/**
 * Appels de l'outil Initiative (V3.1-38), sortis des composants : ils partent
 * tous d'un geste du MJ ou du signal temps réel (« relire »), jamais d'un
 * chargement après affichage. Le fichier n'a aucun effet de montage (cliquet
 * du câblage, docs/CABLAGE.md §6). Un échec lève une `ErreurInitiative` dont
 * le message est AFFICHÉ : rien n'est avalé.
 */

export class ErreurInitiative extends Error {}

const ENTETES_JSON = { "Content-Type": "application/json" };

async function appeler<T>(url: string, init: RequestInit, parDefaut: string): Promise<T> {
  const res = await fetch(url, init);
  const corps: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const message = corps && typeof corps === "object" && typeof (corps as { error?: unknown }).error === "string" ? (corps as { error: string }).error : parDefaut;
    throw new ErreurInitiative(message);
  }
  return corps as T;
}

function post<T>(url: string, corps: object | undefined, parDefaut: string): Promise<T> {
  return appeler<T>(url, { method: "POST", headers: ENTETES_JSON, body: JSON.stringify(corps ?? {}) }, parDefaut);
}

const base = (campaignId: string) => `/api/campaigns/${campaignId}/combats`;

// ---- le combat -----------------------------------------------------------------

/** Relit le combat et ses participants (signal temps réel, ou après un geste dont la réponse ne suffit pas). */
export function lireCombat(campaignId: string, combatId: string, parDefaut: string): Promise<CombatDetail> {
  return appeler<CombatDetail>(`${base(campaignId)}/${combatId}`, {}, parDefaut);
}

/** Les combats de la campagne, du plus récent au plus ancien (MJ seulement). */
export function listerCombats(campaignId: string, parDefaut: string): Promise<{ combats: CombatRow[] }> {
  return appeler<{ combats: CombatRow[] }>(base(campaignId), {}, parDefaut);
}

export function creerCombat(campaignId: string, parDefaut: string): Promise<CombatRow> {
  return post<CombatRow>(base(campaignId), { name: null, monsters: [] }, parDefaut);
}

export function supprimerCombat(campaignId: string, combatId: string, parDefaut: string): Promise<unknown> {
  return appeler<unknown>(`${base(campaignId)}/${combatId}`, { method: "DELETE" }, parDefaut);
}

export function renommerCombat(campaignId: string, combatId: string, name: string | null, parDefaut: string): Promise<CombatRow> {
  return appeler<CombatRow>(`${base(campaignId)}/${combatId}`, { method: "PATCH", headers: ENTETES_JSON, body: JSON.stringify({ name }) }, parDefaut);
}

/** Changement de statut par la route de détail : pas engagé, jets d'initiative, commencé ou terminé (pas « suspendu » : trois routes à part). */
export function changerStatut(campaignId: string, combatId: string, status: "draft" | "rolling" | "running" | "ended", parDefaut: string): Promise<CombatRow> {
  return appeler<CombatRow>(`${base(campaignId)}/${combatId}`, { method: "PATCH", headers: ENTETES_JSON, body: JSON.stringify({ status }) }, parDefaut);
}

/** « Round 1 » : le combat passe à « commencé ». */
export function commencerRound(campaignId: string, combatId: string, parDefaut: string): Promise<CombatRow> {
  return post<CombatRow>(`${base(campaignId)}/${combatId}/begin`, undefined, parDefaut);
}

export function terminerCombat(campaignId: string, combatId: string, parDefaut: string): Promise<CombatRow> {
  return post<CombatRow>(`${base(campaignId)}/${combatId}/end`, undefined, parDefaut);
}

/** « Quitter le combat » : suspendu, rien n'est perdu. */
export function suspendreCombat(campaignId: string, combatId: string, parDefaut: string): Promise<CombatRow> {
  return post<CombatRow>(`${base(campaignId)}/${combatId}/pause`, undefined, parDefaut);
}

/** « Reprendre tel quel » : même round, même tour. */
export function reprendreCombat(campaignId: string, combatId: string, parDefaut: string): Promise<CombatRow> {
  return post<CombatRow>(`${base(campaignId)}/${combatId}/resume`, undefined, parDefaut);
}

/** « Recommencer » : initiatives effacées, retour aux jets, round 0. */
export function recommencerCombat(campaignId: string, combatId: string, parDefaut: string): Promise<CombatRow> {
  return post<CombatRow>(`${base(campaignId)}/${combatId}/restart`, undefined, parDefaut);
}

export function changerTour(campaignId: string, combatId: string, direction: "next" | "previous", parDefaut: string): Promise<CombatRow> {
  return post<CombatRow>(`${base(campaignId)}/${combatId}/turn`, { direction }, parDefaut);
}

export function annulerDerniereAction(campaignId: string, combatId: string, parDefaut: string): Promise<unknown> {
  return post<unknown>(`${base(campaignId)}/${combatId}/undo`, undefined, parDefaut);
}

/** Le serveur lance l'initiative de ces participants (un appel chacun, ensemble : règle 8, jamais dans le navigateur). */
export async function lancerInitiatives(campaignId: string, combatId: string, participantIds: readonly string[], parDefaut: string): Promise<void> {
  await Promise.all(participantIds.map((participantId) => post<unknown>(`${base(campaignId)}/${combatId}/roll-initiative`, { participantId }, parDefaut)));
}

// ---- les participants -----------------------------------------------------------

export interface CorrectifParticipant {
  initiative?: number;
  ac?: number;
  hpCurrent?: number;
  tempHp?: number;
  conditions?: string[];
  /** Renommage d'un adversaire. */
  label?: string;
}

export function modifierParticipant(
  campaignId: string,
  combatId: string,
  participantId: string,
  correctif: CorrectifParticipant,
  note: string,
  parDefaut: string
): Promise<CombatParticipantRow> {
  return appeler<CombatParticipantRow>(
    `${base(campaignId)}/${combatId}/participants/${participantId}`,
    { method: "PATCH", headers: ENTETES_JSON, body: JSON.stringify({ ...correctif, note }) },
    parDefaut
  );
}

export type AjoutParticipant =
  | { sourceKind: "entity"; entityId: string; isAlly: true }
  | { sourceKind: "statblock"; entryKey: string; label: string; isAlly: false }
  | { sourceKind: "custom"; label: string; isAlly: false; ac: number | null; hpMax: number | null };

export function ajouterParticipant(campaignId: string, combatId: string, ajout: AjoutParticipant, parDefaut: string): Promise<CombatParticipantRow> {
  return post<CombatParticipantRow>(`${base(campaignId)}/${combatId}/participants`, ajout, parDefaut);
}

export function retirerParticipant(campaignId: string, combatId: string, participantId: string, parDefaut: string): Promise<unknown> {
  return appeler<unknown>(`${base(campaignId)}/${combatId}/participants/${participantId}`, { method: "DELETE" }, parDefaut);
}

// ---- les actions d'un participant ----------------------------------------------------

export function lireCaracteristiques(campaignId: string, combatId: string, participantId: string, parDefaut: string): Promise<ParticipantCharacteristics> {
  return appeler<ParticipantCharacteristics>(`${base(campaignId)}/${combatId}/participants/${participantId}/characteristics`, {}, parDefaut);
}

/** Un bloc d'entité, tel que la route des blocs le rend (on n'y lit que le type et les données). */
export interface BlocEntiteLu {
  id: string;
  blockType: string;
  data: unknown;
}

/** Les blocs d'une entité (inventaire, sorts) — pour lister les armes équipées et les sorts préparés d'un PJ ou PNJ. */
export function lireBlocsEntite(entityId: string, parDefaut: string): Promise<BlocEntiteLu[]> {
  return appeler<BlocEntiteLu[]>(`/api/entities/${entityId}/blocks`, {}, parDefaut);
}

/** Un jet ciblé : le serveur lance, tranche et applique (règle 8). */
export function lancerJetCible(campaignId: string, combatId: string, corps: TargetedRollInput, parDefaut: string): Promise<ReponseJetCible> {
  return post<ReponseJetCible>(`${base(campaignId)}/${combatId}/targeted-roll`, corps, parDefaut);
}

/**
 * V3.1-107 : le jet ciblé d'une joueuse avec son PJ (`player-targeted-roll`). La
 * réponse est déjà filtrée (ni CA ni PV d'adversaire). Un refus (409 d'un sort à
 * sauvegarde, 503 du moteur sans clé) lève une `ErreurInitiative` dont le message
 * est AFFICHÉ tel quel.
 */
export function lancerJetCibleJoueur(campaignId: string, combatId: string, corps: PlayerTargetedRollInput, parDefaut: string): Promise<ReponseJetCible> {
  return post<ReponseJetCible>(`${base(campaignId)}/${combatId}/player-targeted-roll`, corps, parDefaut);
}
