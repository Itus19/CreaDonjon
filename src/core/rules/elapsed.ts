import { DAY_MINUTES, type GameTime } from "./scene";

/**
 * V3.2-18 — L'horloge suit l'histoire (ADR 0112).
 *
 * Deux sources de durée, et le moteur tranche toujours :
 *
 * 1. **Le joueur l'écrit** (« je fais ces trois heures de travail ») : un
 *    lexique fermé la lit, et l'horloge avance AVANT la narration. Marche
 *    sans aucune IA.
 * 2. **Sinon, l'IA la propose** dans une liste fermée (`ELAPSED_CHOICES`) ;
 *    le moteur la borne (rien en combat, 8 heures au plus hors « jusqu'au
 *    matin ») et l'applique après la narration.
 *
 * S'y ajoute le temps de parole : un tour où l'on parle dure au moins deux
 * minutes. Toutes ces fonctions sont pures : aucune ne lit l'heure réelle,
 * aucune n'écrit.
 */

/** Ce que le joueur a écrit : une durée en minutes, ou « jusqu'au matin » (dépend de l'heure, résolu plus tard). */
export type DureeExplicite = { kind: "minutes"; minutes: number } | { kind: "until_morning" };

/** Une journée au plus : une faute de frappe (« 300 heures ») ne fait pas vieillir la partie d'un an. */
export const MAX_EXPLICIT_MINUTES = DAY_MINUTES;

/** Huit heures : une ellipse plus longue proposée par l'IA est presque toujours une nuit, qui a son propre choix. */
export const MAX_PROPOSED_MINUTES = 8 * 60;

/** L'heure du « matin » : celle où la lumière redevient « plein jour » moins une heure (`lightingAt`). */
export const MORNING_HOUR = 7;

const NOMBRES: Record<string, number> = {
  un: 1,
  une: 1,
  deux: 2,
  trois: 3,
  quatre: 4,
  cinq: 5,
  six: 6,
  sept: 7,
  huit: 8,
  neuf: 9,
  dix: 10,
  onze: 11,
  douze: 12,
  quinze: 15,
  vingt: 20,
  trente: 30,
  quarante: 40,
  "quarante-cinq": 45,
  cinquante: 50,
  soixante: 60,
};

const NOMBRE = `(\\d{1,3}|${Object.keys(NOMBRES)
  .sort((a, b) => b.length - a.length)
  .join("|")})`;

/** Une heure du jour (« à 8 h », « vers huit heures ») n'est pas une durée. */
const PREFIXE_HEURE_DU_JOUR = /(?:\b(?:a|vers|des|avant|apres|jusqu'a)\s+)$/;

function normaliser(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[’]/g, "'")
    .toLowerCase();
}

function valeur(mot: string): number {
  return /^\d+$/.test(mot) ? Number(mot) : (NOMBRES[mot] ?? 0);
}

/** La durée écrite par le joueur, ou `null`. La première trouvée l'emporte. */
export function dureeExplicite(texte: string): DureeExplicite | null {
  const t = normaliser(texte);
  if (/\b(jusqu'au matin|toute la nuit|jusqu'a l'aube|jusqu'au lever du jour|jusqu'au lendemain)\b/.test(t)) return { kind: "until_morning" };
  if (/\bdemi-heure\b/.test(t)) return { kind: "minutes", minutes: 30 };
  if (/\bquart d'heure\b/.test(t)) return { kind: "minutes", minutes: 15 };

  const heures = new RegExp(`(?<![\\p{L}\\d])${NOMBRE}\\s*(?:heures?|h)(?![\\p{L}])(\\s+et\\s+demie)?`, "u");
  const h = heures.exec(t);
  if (h && !PREFIXE_HEURE_DU_JOUR.test(t.slice(0, h.index))) {
    const minutes = valeur(h[1]!) * 60 + (h[2] ? 30 : 0);
    if (minutes > 0) return { kind: "minutes", minutes: Math.min(minutes, MAX_EXPLICIT_MINUTES) };
  }
  const minutesRe = new RegExp(`(?<![\\p{L}\\d])${NOMBRE}\\s*(?:minutes?|min)(?![\\p{L}])`, "u");
  const m = minutesRe.exec(t);
  if (m && !PREFIXE_HEURE_DU_JOUR.test(t.slice(0, m.index))) {
    const minutes = valeur(m[1]!);
    if (minutes > 0) return { kind: "minutes", minutes: Math.min(minutes, MAX_EXPLICIT_MINUTES) };
  }
  return null;
}

/** Minutes jusqu'au prochain `MORNING_HOUR` h 00 : avant l'aube, c'est le jour même ; sinon le lendemain. */
export function minutesJusquAuMatin(time: GameTime): number {
  const maintenant = time.hour * 60 + time.minute;
  const matin = MORNING_HOUR * 60;
  return maintenant < matin ? matin - maintenant : DAY_MINUTES - maintenant + matin;
}

/** Résout une durée explicite en minutes, à l'heure donnée. */
export function minutesExplicites(duree: DureeExplicite, time: GameTime): number {
  return duree.kind === "until_morning" ? minutesJusquAuMatin(time) : duree.minutes;
}

/** La liste fermée que l'IA choisit (`elapsed` de l'outil de narration). */
export const ELAPSED_CHOICES = ["instant", "quelques_minutes", "quart_d_heure", "demi_heure", "une_heure", "plusieurs_heures", "jusqu_au_matin"] as const;
export type ElapsedChoice = (typeof ELAPSED_CHOICES)[number];

export interface ElapsedProposal {
  kind: ElapsedChoice;
  /** Seulement pour `plusieurs_heures` : borné à 2-8 par le moteur, quoi que l'IA écrive. */
  hours?: number;
}

const MINUTES_PAR_CHOIX: Record<Exclude<ElapsedChoice, "plusieurs_heures" | "jusqu_au_matin">, number> = {
  instant: 0,
  quelques_minutes: 5,
  quart_d_heure: 15,
  demi_heure: 30,
  une_heure: 60,
};

/**
 * La durée que le moteur ACCEPTE pour une proposition de l'IA. En combat,
 * zéro : un round dure six secondes et le combat a son propre temps.
 */
export function minutesProposees(proposal: ElapsedProposal, time: GameTime, inCombat: boolean): number {
  if (inCombat) return 0;
  if (proposal.kind === "jusqu_au_matin") return minutesJusquAuMatin(time);
  if (proposal.kind === "plusieurs_heures") {
    const heures = Math.min(Math.max(Math.round(proposal.hours ?? 2), 2), MAX_PROPOSED_MINUTES / 60);
    return heures * 60;
  }
  return MINUTES_PAR_CHOIX[proposal.kind];
}

/** Un tour où l'on parle : deux minutes au moins, plus une par tranche de cent mots échangés. */
export function minutesDeParole(motsEchanges: number): number {
  return 2 + Math.floor(Math.max(0, motsEchanges) / 100);
}

/** Le nombre de mots d'un texte, pour `minutesDeParole`. */
export function compterMots(texte: string): number {
  return texte.split(/\s+/).filter((m) => /[\p{L}\p{N}]/u.test(m)).length;
}

function libelleDuree(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}

/** Le fait que la narration reçoit quand le moteur a fait passer le temps : la durée et l'heure atteinte, jamais à recalculer. */
export function phraseDuree(minutes: number, apres: GameTime): string {
  return `${libelleDuree(minutes)} passent. Il est maintenant ${String(apres.hour).padStart(2, "0")}h${String(apres.minute).padStart(2, "0")} (jour ${apres.day}).`;
}
