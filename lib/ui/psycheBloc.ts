/**
 * V3.1-70 — noyau pur des blocs Personnalité et Convictions : les deux pôles
 * prioritaires (★), la confirmation d'un grand écart, les aspirations par
 * horizon, et le « brut / appliqué » des souvenirs. Les composants ne font
 * que brancher.
 */

import { applyDelta } from "@/src/core/psyche/apply";
import { worldviewTension, type WorldviewTension } from "@/src/core/psyche/tension";
import type { WorldviewPoleKey } from "@/src/core/psyche/keys";

/** Deux pôles prioritaires au plus : au-delà, ce ne serait plus une priorité. */
export const MAX_PRIORITAIRES = 2;

/**
 * Pose ou retire une ★. Déjà prioritaire : elle part. Sinon elle s'ajoute à la
 * fin ; une troisième retire la PLUS ANCIENNE. L'ordre est celui des clics
 * (c'est lui qui tranche quand deux traits s'opposent).
 */
export function basculerPrioritaire<K extends string>(priorite: readonly K[], cle: K): K[] {
  if (priorite.includes(cle)) return priorite.filter((k) => k !== cle);
  return [...priorite, cle].slice(-MAX_PRIORITAIRES);
}

export type AnnoncePrioritaires =
  | { cle: "aucun" }
  | { cle: "un"; premier: string }
  | { cle: "deux"; premier: string; second: string };

/** Ce que l'annonce dit : « Pôles prioritaires : Autorité puis Prudence. » (le composant met la phrase en français). */
export function annoncePrioritaires<K extends string>(
  priorite: readonly K[],
  libelle: (cle: K) => string,
): AnnoncePrioritaires {
  if (priorite.length === 0) return { cle: "aucun" };
  if (priorite.length === 1) return { cle: "un", premier: libelle(priorite[0]) };
  return { cle: "deux", premier: libelle(priorite[0]), second: libelle(priorite[1]) };
}

/** Au-delà de cet écart (en valeur absolue), un souvenir est « un moment rare ». */
export const SEUIL_CONFIRMATION = 40;

export function confirmationRequise(delta: number): boolean {
  return Math.abs(delta) > SEUIL_CONFIRMATION;
}

/** Le pas des boutons − / + de l'écart, borné à ±100. */
export const PAS_ECART = 10;

export function ecartApresPas(delta: number, sens: 1 | -1): number {
  return Math.min(100, Math.max(-100, delta + sens * PAS_ECART));
}

export type EtatAjout = { etape: "saisie" } | { etape: "confirmation"; delta: number };
export type EvenementAjout = { type: "ajouter"; delta: number } | { type: "confirmer" } | { type: "annuler" };

/**
 * La saisie d'un souvenir, de « Ajouter » à l'écriture. `ecrire` est l'écart à
 * écrire MAINTENANT, ou `null` : un écart > 40 demande d'abord confirmation,
 * et refuser (« Annuler ») ne laisse rien d'écrit. Un écart nul n'écrit rien.
 */
export function avancerAjout(
  etat: EtatAjout,
  evenement: EvenementAjout,
): { etat: EtatAjout; ecrire: number | null } {
  switch (evenement.type) {
    case "ajouter":
      if (evenement.delta === 0) return { etat: { etape: "saisie" }, ecrire: null };
      if (confirmationRequise(evenement.delta)) {
        return { etat: { etape: "confirmation", delta: evenement.delta }, ecrire: null };
      }
      return { etat: { etape: "saisie" }, ecrire: evenement.delta };
    case "confirmer":
      return etat.etape === "confirmation"
        ? { etat: { etape: "saisie" }, ecrire: etat.delta }
        : { etat, ecrire: null };
    case "annuler":
      return { etat: { etape: "saisie" }, ecrire: null };
  }
}

export const HORIZONS = ["life", "arc", "session"] as const;
export type HorizonAspiration = (typeof HORIZONS)[number];

/** Les aspirations rangées par horizon, chacune gardant l'ordre où elles ont été saisies. */
export function regrouperAspirations<T extends { horizon: HorizonAspiration }>(
  aspirations: readonly T[],
): Record<HorizonAspiration, T[]> {
  const groupes: Record<HorizonAspiration, T[]> = { life: [], arc: [], session: [] };
  for (const a of aspirations) groupes[a.horizon].push(a);
  return groupes;
}

/** Toucher les trois points : 1 → 2 → 3 → 1. */
export function intensiteSuivante(intensite: number): 1 | 2 | 3 {
  return intensite >= 3 ? 1 : intensite === 1 ? 2 : 3;
}

interface SouvenirBrut {
  id: string;
  created_at: string;
  deltas: Partial<Record<string, number>>;
}

/**
 * Le « appliqué » de chaque souvenir : on rejoue le journal depuis 0 avec
 * l'amortissement (`applyDelta`) et on note, pour chaque écart BRUT, ce qu'il a
 * réellement changé. `evenements` vient du plus récent au plus ancien.
 *
 * Le résultat n'est fiable que si l'on connaît tout l'historique : `complet`
 * est faux quand la liste est tronquée. Et pôle par pôle, si le rejeu ne
 * retombe pas sur la valeur ACTUELLE (un pôle posé à la main à la création,
 * par exemple), on ne dit rien de ce pôle plutôt que de mentir.
 */
export function appliquesParEvenement(
  evenements: readonly SouvenirBrut[],
  valeursActuelles: Readonly<Partial<Record<string, number>>>,
  complet: boolean,
): Record<string, Partial<Record<string, number>>> {
  if (!complet) return {};
  const chronologique = [...evenements]
    .map((e, i) => ({ e, i }))
    .sort((a, b) => a.e.created_at.localeCompare(b.e.created_at) || b.i - a.i)
    .map(({ e }) => e);
  const courant: Record<string, number> = {};
  const appliques: Record<string, Partial<Record<string, number>>> = {};
  for (const evenement of chronologique) {
    for (const [cle, delta] of Object.entries(evenement.deltas)) {
      if (delta === undefined) continue;
      const avant = courant[cle] ?? 0;
      const apres = applyDelta(avant, delta);
      courant[cle] = apres;
      (appliques[evenement.id] ??= {})[cle] = apres - avant;
    }
  }
  for (const [cle, valeur] of Object.entries(courant)) {
    if (valeur === (valeursActuelles[cle] ?? 0)) continue;
    for (const id of Object.keys(appliques)) delete appliques[id][cle];
  }
  return appliques;
}

/** Un pôle de convictions tel que le bloc le stocke. */
interface PoleConviction {
  key: WorldviewPoleKey;
  value: number;
}

/**
 * La tension à écrire sous le radar : l'axe au plus grand écart, SEULEMENT
 * s'il atteint 3 crans. `null` sinon (2 crans ne font pas une tension).
 */
export function tensionAffichee(
  entite: readonly PoleConviction[],
  faction: readonly PoleConviction[],
): WorldviewTension | null {
  const t = worldviewTension(entite, faction);
  return t && t.tension ? t : null;
}

/**
 * Le côté vers lequel un écart pousse un pôle : un nombre ne s'affiche jamais
 * au lecteur, mais « vers Prudence » oui. Écart positif : le bout positif.
 */
export function poleVise(
  fin: { positive: { label: string }; negative: { label: string } },
  delta: number,
): string {
  return delta > 0 ? fin.positive.label : fin.negative.label;
}
