/**
 * Logique pure de l'outil Table du MJ (V3.1-34), sortie du composant pour être
 * testée sans navigateur : groupes de compteurs, ligne repliée d'un PJ, dés de
 * vie, aperçu de « Toute la table », fusion d'une relecture. Aucun appel réseau
 * ici (ils vivent dans `tableApi.ts`), et aucune règle de jeu : les calculs
 * viennent du noyau (`partagerEgalement`, `applyCurrencyDelta`,
 * `hasReachedNextLevel`).
 */
import type { TablePc, TableResource } from "@/src/server/services/tableParty";
import { partagerEgalement } from "@/src/core/rules/partage";
import { XP_LEVEL_THRESHOLDS, hasReachedNextLevel } from "@/src/core/rules/experience";
import { applyCurrencyDelta, CURRENCY_ORDER, type CoinType, type Currency } from "@/src/core/rules/currency";
import { etatMourant, type EtatMourant } from "./etatMourant";

/** Ce que `GET /api/entities/[id]/sheet` renvoie : de quoi relire un PJ après un geste, jamais toute la table. */
export type EtatPj = Pick<TablePc, "sheet" | "hitDiceTotals" | "runtimeState">;

// ---- « Ce qui se dépense » ----

export type CleGroupeCompteurs = "reposCourt" | "reposLong" | "autres";

export interface GroupeCompteurs {
  cle: CleGroupeCompteurs;
  compteurs: TableResource[];
}

/** Repos court (tout ou un seul rendu), repos long, puis le reste (aube, jamais). Un groupe vide n'existe pas. */
export function groupesDeCompteurs(resources: readonly TableResource[]): GroupeCompteurs[] {
  const groupes: GroupeCompteurs[] = [
    { cle: "reposCourt", compteurs: resources.filter((r) => r.recharge === "short_rest" || r.recharge === "short_rest_one") },
    { cle: "reposLong", compteurs: resources.filter((r) => r.recharge === "long_rest") },
    { cle: "autres", compteurs: resources.filter((r) => r.recharge === "dawn" || r.recharge === "never") },
  ];
  return groupes.filter((g) => g.compteurs.length > 0);
}

// ---- Dés de vie ----

export interface DeDeVie {
  die: "d6" | "d8" | "d10" | "d12";
  restants: number;
  total: number;
}

const DES_VALIDES = ["d6", "d8", "d10", "d12"] as const;

/** Les dés de vie du PJ, du plus petit au plus grand : restants (état de jeu, sinon le total) sur total. */
export function desDeVie(pc: Pick<TablePc, "hitDiceTotals" | "runtimeState">): DeDeVie[] {
  const restantsConnus = pc.runtimeState.state.hit_dice;
  return DES_VALIDES.filter((die) => pc.hitDiceTotals[die] !== undefined).map((die) => {
    const total = pc.hitDiceTotals[die] ?? 0;
    return { die, total, restants: Math.min(total, restantsConnus[die] ?? total) };
  });
}

// ---- Ligne repliée (téléphone) ----

export interface LigneRepliee {
  nom: string;
  niveau: number;
  /** « joueur · CA · PV » (le joueur seulement s'il y en a un), déjà composé de morceaux, jamais d'une phrase. */
  joueur: string | null;
  ca: number;
  pv: string;
  etats: string[];
  classes: string | null;
  etat: EtatMourant;
}

export function ligneRepliee(pc: TablePc): LigneRepliee {
  const { hp, conditions, death_saves } = pc.runtimeState.state;
  return {
    nom: pc.name,
    niveau: pc.level,
    joueur: pc.playerName,
    ca: pc.sheet.ac.value,
    pv: `${hp.current}/${pc.runtimeState.hpMax}`,
    etats: conditions,
    classes: pc.classesLabel,
    etat: etatMourant({ current: hp.current }, death_saves),
  };
}

// ---- XP (anneau de la carte) ----

/** Plafond et part de l'anneau d'XP : même calcul que la fiche (PlayableCharacterSheet). */
export function progressionXp(niveau: number, xp: number): { xpCeiling: number; xpPct: number } {
  const index = Math.min(niveau, XP_LEVEL_THRESHOLDS.length) - 1;
  const plancher = XP_LEVEL_THRESHOLDS[index] ?? 0;
  const plafond = XP_LEVEL_THRESHOLDS[index + 1] ?? plancher;
  const pct = plafond > plancher ? Math.min(100, Math.max(0, ((xp - plancher) / (plafond - plancher)) * 100)) : 100;
  return { xpCeiling: plafond, xpPct: pct };
}

// ---- Fusion d'une relecture ----

/** Remplace l'état de jeu d'un PJ par celui que le serveur vient de renvoyer ; les compteurs suivent (`used` = consommées). */
export function fusionnerEtat(pc: TablePc, etat: EtatPj, currency?: Currency): TablePc {
  const used = etat.runtimeState.state.resources;
  return {
    ...pc,
    sheet: etat.sheet,
    hitDiceTotals: etat.hitDiceTotals,
    runtimeState: etat.runtimeState,
    resources: pc.resources.map((r) => ({ ...r, used: used[r.id] ?? 0 })),
    currency: currency ?? pc.currency,
  };
}

// ---- Pièces ----

export type DeltaPieces = Partial<Record<CoinType, number>>;

/**
 * Le serveur a-t-il fait du change ? Sans change, la bourse d'après est la
 * bourse d'avant plus l'écart, pièce par pièce. Tout autre résultat (10 pa
 * devenus 1 po, une po cassée en argent) est un change du serveur.
 */
export function changeFait(avant: Currency, delta: DeltaPieces, apres: Currency): boolean {
  return CURRENCY_ORDER.some((piece) => apres[piece] !== avant[piece] + (delta[piece] ?? 0));
}

/** Un entier non nul, signe permis (« -5 », « +3 ») ; tout le reste (vide, décimale, lettres, énorme nombre) vaut `null`. */
export function lireMontant(texte: string): number | null {
  const net = texte.trim();
  if (!/^[+-]?\d+$/.test(net)) return null;
  const montant = Number(net);
  if (montant === 0 || !Number.isSafeInteger(montant)) return null;
  return montant;
}

// ---- « Toute la table » : aperçu ----

export type ModePartage = "partager" | "chacun";

export interface LigneApercu {
  entityId: string;
  nom: string;
  gain: number;
  /** XP : le total d'après ; pièces : le compte de la pièce choisie d'après, `null` si la bourse ne suffit pas (le serveur refuserait). */
  nouveauTotal: number | null;
  /** XP seulement : le niveau atteint si le nouveau total franchit le seuil du suivant (`hasReachedNextLevel`). */
  monteAuNiveau: number | null;
}

export interface Apercu {
  lignes: LigneApercu[];
  parPersonne: number;
  /** Ce qui ne se divise pas à parts égales : affiché, jamais distribué. Toujours 0 pour « à chacun ». */
  reste: number;
}

/** Le gain de chaque PJ coché : « à chacun » donne le montant à tous, « à partager » le divise (`partagerEgalement`). */
function repartir(montant: number, mode: ModePartage, personnes: number): { parPersonne: number; reste: number } {
  if (personnes < 1) return { parPersonne: 0, reste: 0 };
  return mode === "chacun" ? { parPersonne: montant, reste: 0 } : partagerEgalement(montant, personnes);
}

export function apercuXp(pcs: readonly TablePc[], montant: number, mode: ModePartage): Apercu {
  const { parPersonne, reste } = repartir(montant, mode, pcs.length);
  const lignes = pcs.map((pc) => {
    const xp = pc.runtimeState.state.xp;
    const nouveau = Math.max(0, xp + parPersonne);
    return {
      entityId: pc.entityId,
      nom: pc.name,
      gain: parPersonne,
      nouveauTotal: nouveau,
      monteAuNiveau: hasReachedNextLevel(pc.level, nouveau) ? pc.level + 1 : null,
    };
  });
  return { lignes, parPersonne, reste };
}

export function apercuPieces(pcs: readonly TablePc[], montant: number, mode: ModePartage, piece: CoinType): Apercu {
  const { parPersonne, reste } = repartir(montant, mode, pcs.length);
  const lignes = pcs.map((pc) => {
    const apres = parPersonne === 0 ? pc.currency : applyCurrencyDelta(pc.currency, { [piece]: parPersonne });
    return {
      entityId: pc.entityId,
      nom: pc.name,
      gain: parPersonne,
      nouveauTotal: apres ? apres[piece] : null,
      monteAuNiveau: null,
    };
  });
  return { lignes, parPersonne, reste };
}
