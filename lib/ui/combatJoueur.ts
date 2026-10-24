import type { PlayerCombatParticipant, WoundState } from "@/src/core/rules/combatPlayerView";

/**
 * V3.1-38 — le côté joueuse de l'initiative : ce qu'elle voit du combat en cours
 * et la logique pure de l'invitation. Les `fetch` de l'écran vivent ici (et non
 * dans le hook ou le composant) : le cliquet de câblage compte les fichiers qui
 * mêlent `useEffect` et `fetch(` (docs/CABLAGE.md §6).
 */

export interface InfosCombatJoueur {
  id: string;
  name: string | null;
  status: string;
  round: number;
  turnIndex: number;
  updatedAt: string;
}

export type VueCombatJoueur =
  | { kind: "none" }
  | { kind: "ok"; combat: InfosCombatJoueur; participants: PlayerCombatParticipant[] };

export const VUE_AUCUN_COMBAT: VueCombatJoueur = { kind: "none" };

/** Durée du décompte « validé dans 4 s… » avant la fermeture de l'invitation. */
export const DECOMPTE_VALIDATION_S = 4;

/** Le participant de la joueuse : le seul allié lié à la fiche qu'elle a réclamée. */
export function monParticipant(participants: readonly PlayerCombatParticipant[], entityId: string): PlayerCombatParticipant | null {
  const miens = participants.filter((p) => p.side === "ally" && p.entityId === entityId);
  return miens.length === 1 ? miens[0] : null;
}

/**
 * L'invitation est ouverte quand le MJ attend les jets (`rolling`) et que
 * l'initiative de la joueuse est encore vide. Si le MJ la saisit (signal temps
 * réel), l'initiative n'est plus vide : l'invitation se ferme d'elle-même.
 */
export function invitationOuverte(vue: VueCombatJoueur, entityId: string): boolean {
  if (vue.kind !== "ok" || vue.combat.status !== "rolling") return false;
  const moi = monParticipant(vue.participants, entityId);
  return moi !== null && moi.initiative === null;
}

/** Le mode combat (ordre du tour, économie d'action) : seulement une fois les jets faits. */
export function modeCombat(vue: VueCombatJoueur): boolean {
  return vue.kind === "ok" && vue.combat.status === "running";
}

const CLES_BLESSURE: Record<WoundState, string> = {
  unhurt: "blessureIndemne",
  hurt: "blessureBlesse",
  bloodied: "blessureEnSang",
  down: "blessureHorsDeCombat",
};

/** La clé de libellé (espace « combatJoueur ») d'un état de blessure ; `null` si le MJ n'a pas saisi les PV. */
export function cleBlessure(wound: WoundState | null): string | null {
  return wound === null ? null : CLES_BLESSURE[wound];
}

// ---- économie d'action : trois cases locales, remises à zéro à chaque tour ----

export interface EconomieAction {
  action: boolean;
  bonus: boolean;
  reaction: boolean;
}

export const ECONOMIE_VIERGE: EconomieAction = { action: false, bonus: false, reaction: false };

/** L'état gardé avec la clé du tour où les cases ont été cochées. */
export interface EconomieDuTour {
  cle: string;
  utilisee: EconomieAction;
}

/**
 * Le « cycle » de la joueuse : de son tour jusqu'au moment où il lui revient.
 * Une réaction cochée pendant le tour d'un autre reste donc cochée jusqu'à son
 * prochain tour. Avant son rang dans le round, on est encore dans le cycle du
 * round précédent. Quand la clé change, les cases repartent à zéro.
 */
export function cleDuCycle(combat: Pick<InfosCombatJoueur, "round" | "turnIndex">, rang: number): string {
  return String(combat.turnIndex >= rang - 1 ? combat.round : combat.round - 1);
}

/** Les cases à afficher : celles cochées pendant CE tour, sinon une économie vierge. */
export function economieAffichee(etat: EconomieDuTour | null, cle: string): EconomieAction {
  return etat !== null && etat.cle === cle ? etat.utilisee : ECONOMIE_VIERGE;
}

export function basculerCase(etat: EconomieDuTour | null, cle: string, quelle: keyof EconomieAction): EconomieDuTour {
  const courante = economieAffichee(etat, cle);
  return { cle, utilisee: { ...courante, [quelle]: !courante[quelle] } };
}

// ---- réseau ----

/** Relit la vue filtrée du combat ; `null` en cas d'échec (l'appelant garde ce qu'il a). */
export async function lireVueCombat(campaignId: string): Promise<VueCombatJoueur | null> {
  const res = await fetch(`/api/campaigns/${campaignId}/combats/active/player`);
  if (!res.ok) throw new Error(`combats/active/player : ${res.status}`);
  const corps = (await res.json()) as { combat: InfosCombatJoueur | null; participants: PlayerCombatParticipant[] };
  if (corps.combat === null) return VUE_AUCUN_COMBAT;
  return { kind: "ok", combat: corps.combat, participants: corps.participants };
}

export type EnvoiInitiative = { mode: "roll" } | { mode: "die"; natural: number; modifierIncluded: boolean };

export class ErreurInitiative extends Error {}

export interface InitiativeEcrite {
  initiative: number;
  /** Le d20 tiré (mode « roll ») ou saisi (modificateur non inclus) ; `null` sinon. */
  natural: number | null;
}

/** Envoie l'initiative de SON PJ ; rend la valeur écrite par le serveur (qui a lancé le dé en mode « roll »). */
export async function envoyerMonInitiative(campaignId: string, combatId: string, envoi: EnvoiInitiative): Promise<InitiativeEcrite> {
  const res = await fetch(`/api/campaigns/${campaignId}/combats/${combatId}/my-initiative`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(envoi),
  });
  const corps = (await res.json().catch(() => null)) as { initiative?: number; natural?: number | null; error?: string } | null;
  if (!res.ok || typeof corps?.initiative !== "number") {
    throw new ErreurInitiative(corps?.error ?? `my-initiative : ${res.status}`);
  }
  return { initiative: corps.initiative, natural: typeof corps.natural === "number" ? corps.natural : null };
}

/** Le texte saisi dans le champ du vrai dé : un entier, sinon `null`. */
export function naturelDepuisSaisie(texte: string): number | null {
  const propre = texte.trim();
  return /^-?\d{1,2}$/.test(propre) ? Number(propre) : null;
}

/** Bornes du champ : 1–20 pour un d20 nu, −10 à 40 pour un total (miroir du schéma serveur, qui reste l'arbitre). */
export function saisieValide(natural: number | null, modificateurInclus: boolean): natural is number {
  if (natural === null) return false;
  return modificateurInclus ? natural >= -10 && natural <= 40 : natural >= 1 && natural <= 20;
}
