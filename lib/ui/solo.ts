import { DIE_TYPES, type DieType } from "@/src/core/dice/roll";
import { lbToKg } from "@/src/core/rules/encumbrance";
import type { EncashedTurnOutcome, PendingRequest, QuestColumnEntry, WikiColumnGroup } from "@/lib/solo/types";
import type { PreReglage, SortieJet } from "@/lib/ui/outilDes";

/**
 * Logique pure de l'écran solo (V3.1-36) : la vue du téléphone lue dans
 * l'adresse, la bande de jauges de la fiche, le tri des quêtes, la recherche
 * du wiki, et la traduction d'une demande de jet en préréglage de l'outil de
 * dés. Rien ici ne lance un dé ni ne calcule un résultat de règle (règle 8) :
 * on décrit la demande que le serveur a posée, et on lit ce qu'il a rendu.
 */

// ---- les vues du téléphone ---------------------------------------------------

export const VUES_SOLO = ["jeu", "monde", "fiche", "quetes"] as const;
export type VueSolo = (typeof VUES_SOLO)[number];

/** La vue demandée par `?vue=` ; le jeu par défaut, pour une valeur absente ou inconnue. */
export function vueDepuisAdresse(valeur: string | null): VueSolo {
  return VUES_SOLO.find((v) => v === valeur) ?? "jeu";
}

/** L'adresse de la page avec la vue changée (sans `?vue=` pour le jeu), les autres paramètres gardés. */
export function adresseVue(chemin: string, recherche: string, vue: VueSolo): string {
  const params = new URLSearchParams(recherche);
  if (vue === "jeu") params.delete("vue");
  else params.set("vue", vue);
  const texte = params.toString();
  return texte === "" ? chemin : `${chemin}?${texte}`;
}

// ---- la bande de jauges --------------------------------------------------------

/** Ce que la bande de la fiche montre : tout est déjà calculé par la fiche, rien n'est stocké. */
export interface JaugesBande {
  ac: number;
  hpCurrent: number;
  hpMax: number;
  /** 0 à 100. */
  pctPv: number;
  level: number;
  /** 0 à 6. */
  exhaustion: number;
  /** La charge portée, en kg (le moteur compte en livres). */
  chargeKg: number;
}

export function jaugesBande(entree: {
  ac: number;
  hpCurrent: number;
  hpMax: number;
  level: number;
  exhaustion: number;
  carriedLb: number;
}): JaugesBande {
  return {
    ac: entree.ac,
    hpCurrent: entree.hpCurrent,
    hpMax: entree.hpMax,
    pctPv: entree.hpMax > 0 ? Math.round((entree.hpCurrent / entree.hpMax) * 100) : 0,
    level: entree.level,
    exhaustion: entree.exhaustion,
    chargeKg: lbToKg(entree.carriedLb),
  };
}

export function jaugesEgales(a: JaugesBande | null, b: JaugesBande | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    a.ac === b.ac &&
    a.hpCurrent === b.hpCurrent &&
    a.hpMax === b.hpMax &&
    a.pctPv === b.pctPv &&
    a.level === b.level &&
    a.exhaustion === b.exhaustion &&
    a.chargeKg === b.chargeKg
  );
}

/**
 * La même demande en cours, relue d'une autre réponse du serveur ? Chaque
 * sondage de la fiche rend un objet neuf : sans cette comparaison, l'écran
 * solo se redessinerait toutes les 4 s pour une demande qui n'a pas changé.
 * Les deux viennent du même schéma (`zPendingRequest`), dans le même ordre de
 * clés : la forme JSON suffit.
 */
export function memeDemande(a: PendingRequest | null, b: PendingRequest | null): boolean {
  if (a === null || b === null) return a === b;
  return JSON.stringify(a) === JSON.stringify(b);
}

// ---- les quêtes ------------------------------------------------------------------

export type FiltreQuetes = "en_cours" | "terminees";

/** Terminée : elle a des étapes et toutes sont faites. (La page ne charge que les quêtes actives.) */
export function queteTerminee(quete: QuestColumnEntry): boolean {
  return quete.objectives.length > 0 && quete.objectives.every((o) => o.done);
}

export function trierQuetes(quetes: readonly QuestColumnEntry[], filtre: FiltreQuetes): QuestColumnEntry[] {
  return quetes.filter((q) => queteTerminee(q) === (filtre === "terminees"));
}

export function progressionQuete(quete: QuestColumnEntry): string {
  return `${quete.objectives.filter((o) => o.done).length}/${quete.objectives.length}`;
}

// ---- la recherche du wiki -----------------------------------------------------

function normaliser(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Les fiches dont le nom contient la recherche (casse et accents ignorés) ; les groupes vides disparaissent. */
export function filtrerWiki(groupes: readonly WikiColumnGroup[], recherche: string): WikiColumnGroup[] {
  const motif = normaliser(recherche);
  if (motif === "") return [...groupes];
  return groupes
    .map((g) => ({ ...g, entries: g.entries.filter((e) => normaliser(e.name).includes(motif)) }))
    .filter((g) => g.entries.length > 0);
}

// ---- « Jouer » ouvre l'outil de dés ----------------------------------------------

/**
 * Le dé que la grille montre pour une demande : celui dont la borne est exacte,
 * sinon le plus petit qui la couvre (des dégâts cumulés, « 9 », n'ont pas de dé à
 * eux). Décoratif : la grille est verrouillée, le serveur lance.
 */
export function deDeLaDemande(dieMax: number): DieType {
  const exact = DIE_TYPES.find((d) => Number(d.slice(1)) === dieMax);
  if (exact) return exact;
  return DIE_TYPES.find((d) => Number(d.slice(1)) >= dieMax) ?? "d100";
}

/** Le préréglage de l'outil de dés pour la demande posée par le serveur ; `lancer` fait le tour. */
export function preReglageDepuisDemande(demande: PendingRequest, lancer: () => Promise<SortieJet | null>): PreReglage {
  return {
    label: demande.what,
    dice: { [deDeLaDemande(demande.die_max)]: 1 },
    modifier: demande.modifier,
    advantage: demande.advantage,
    dc: demande.dc,
    lancer,
  };
}

function enregistrement(valeur: unknown): Record<string, unknown> | null {
  return valeur !== null && typeof valeur === "object" && !Array.isArray(valeur) ? (valeur as Record<string, unknown>) : null;
}

function nombre(valeur: unknown): number | null {
  return typeof valeur === "number" && Number.isFinite(valeur) ? valeur : null;
}

/** Le naturel tiré par le serveur : la première étape de la trace du jet. */
function naturelDeLaTrace(jet: Record<string, unknown> | null): number | null {
  const trace = jet?.trace;
  if (!Array.isArray(trace)) return null;
  return nombre(enregistrement(trace[0])?.value);
}

/**
 * Le tour encaissé, lu pour l'affichage de l'outil de dés. Le détail du tour
 * (`record.detail`, turnIntent.ts) porte le total, le verdict et le naturel
 * sous `attack`, `damage` ou `check` selon la demande. S'il manque, on affiche
 * ce qu'on a (le total à 0, aucun dé) plutôt que d'inventer un résultat.
 */
export function sortieJetDepuisTour(demande: PendingRequest, tour: EncashedTurnOutcome): SortieJet {
  const detail = tour.record.detail;
  const jet = enregistrement(detail.attack) ?? enregistrement(detail.damage) ?? enregistrement(detail.check);
  const naturel = naturelDeLaTrace(jet);
  const faces = Number(deDeLaDemande(demande.die_max).slice(1));
  const desAffiches = naturel !== null && naturel >= 1 && naturel <= faces;

  let verdict: SortieJet["verdict"] = null;
  let dc: number | null = null;
  if (demande.kind === "weapon_attack") {
    dc = nombre(detail.ac);
    verdict = detail.verdict === "hit" ? "success" : detail.verdict === "miss" ? "fail" : null;
  } else if (demande.kind !== "weapon_damage") {
    dc = nombre(jet?.dc);
    verdict = jet?.verdict === "success" ? "success" : jet?.verdict === "fail" ? "fail" : null;
  }

  const estD20 = demande.kind !== "weapon_damage" && naturel !== null && naturel >= 1 && naturel <= 20;
  return {
    who: demande.actor_name,
    what: demande.what,
    chips: demande.chips,
    total: nombre(jet?.total) ?? 0,
    dc,
    verdict,
    hidden: false,
    trace: desAffiches ? [{ text: `1d${faces} (${naturel}) = ${naturel}`, value: naturel }] : [],
    pair: null,
    naturalD20: estD20 ? naturel : null,
    dcPrivate: false,
  };
}
