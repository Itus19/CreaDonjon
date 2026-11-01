import type { DiceRollKind } from "../dice/rollAttribution";
import { TITLE_FAMILIES, TITLE_TEMPLATE_VARIABLES, type PlayerTitleTier, type TitleFamily } from "./titleTiers";

/**
 * V3.1-90 — Les statistiques d'une joueuse, calculées à la lecture : rien
 * n'est stocké (règle 16). Les jets viennent de `listRollsForStats` (V3.1-89,
 * ADR 0064) : ceux de SON personnage, publics, avec le d20 GARDÉ déjà choisi
 * (avantage : le plus haut ; désavantage : le plus bas). Les paliers des
 * titres sont des données (`player_title_tiers`, `titleTiers.ts`).
 */

/** Un jet tel que les statistiques le lisent (la forme de `RollForStats`, sans ce qui ne sert pas ici). */
export interface StatsRoll {
  /** Le d20 gardé ; `null` sans d20 (dégâts, dés de vie…). */
  naturalD20: number | null;
  kind: DiceRollKind | null;
  what: string;
  result: number;
  createdAt: string;
}

/** En dessous, pas d'histogramme ni de titre : le volet montre un état vide. */
export const MIN_D20_ROLLS = 5;

type ActionKind = NonNullable<PlayerTitleTier["action_kind"]>;

const parDate = (rolls: readonly StatsRoll[]) => [...rolls].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
const avecD20 = (rolls: readonly StatsRoll[]) => rolls.filter((r): r is StatsRoll & { naturalD20: number } => r.naturalD20 !== null && r.naturalD20 >= 1 && r.naturalD20 <= 20);

export interface D20Histogram {
  /** Vingt compteurs : `counts[0]` = les 1, `counts[19]` = les 20 (les chiffres affichés SONT ces colonnes). */
  counts: number[];
  total: number;
  tooFew: boolean;
}

/** Une colonne par face, sur le d20 GARDÉ : un jet compte une fois, même avec avantage (règle de l'auteur, 9 octobre). */
export function d20Histogram(rolls: readonly StatsRoll[]): D20Histogram {
  const counts: number[] = Array(20).fill(0);
  const d20 = avecD20(rolls);
  for (const r of d20) counts[r.naturalD20 - 1] += 1;
  return { counts, total: d20.length, tooFew: d20.length < MIN_D20_ROLLS };
}

/** Nombre de jets à d20. */
export function rollCount(rolls: readonly StatsRoll[]): number {
  return avecD20(rolls).length;
}

/** Moyenne des d20 gardés, au dixième ; `null` sans jet. */
export function d20Average(rolls: readonly StatsRoll[]): number | null {
  const d20 = avecD20(rolls);
  if (d20.length === 0) return null;
  return Math.round((10 * d20.reduce((s, r) => s + r.naturalD20, 0)) / d20.length) / 10;
}

/** La plus longue suite de jets à d20 consécutifs (ordre des dates) donnant `face` — « dont 3 d'affilée ». */
export function longestStreak(rolls: readonly StatsRoll[], face: number): number {
  let best = 0;
  let current = 0;
  for (const r of avecD20(parDate(rolls))) {
    current = r.naturalD20 === face ? current + 1 : 0;
    best = Math.max(best, current);
  }
  return best;
}

/** La nature d'action d'un jet pour l'action favorite ; `null` : il ne compte pas (dégâts, jet libre, genre inconnu). */
function actionKindOf(roll: StatsRoll): ActionKind | null {
  switch (roll.kind) {
    case "attack":
      // L'attaque sournoise n'a pas de genre à elle (ADR 0064) : son libellé la distingue.
      return /sournoise|sneak attack/i.test(roll.what) ? "sneak_attack" : "attack";
    case "spell":
      return "spell";
    case "heal":
      return "heal";
    case "check":
    case "save":
      return "check";
    default:
      return null;
  }
}

/** Le plus fréquent d'une liste ; à égalité, le plus récent (dernier vu dans l'ordre des dates). */
function plusFrequent<K>(entries: readonly { key: K; at: number }[]): { key: K; count: number } | null {
  const tally = new Map<K, { count: number; last: number }>();
  for (const e of entries) {
    const t = tally.get(e.key) ?? { count: 0, last: -Infinity };
    tally.set(e.key, { count: t.count + 1, last: Math.max(t.last, e.at) });
  }
  let best: { key: K; count: number; last: number } | null = null;
  for (const [key, t] of tally) {
    if (!best || t.count > best.count || (t.count === best.count && t.last > best.last)) best = { key, ...t };
  }
  return best ? { key: best.key, count: best.count } : null;
}

export interface FavoriteAction {
  actionKind: ActionKind;
  /** Son libellé le plus fréquent (« Attaque — Rapière »). */
  what: string;
  count: number;
}

/** L'action favorite (hors dégâts et jet libre), avec son libellé le plus fréquent ; égalité : le plus récent. */
export function favoriteAction(rolls: readonly StatsRoll[]): FavoriteAction | null {
  const comptes = rolls.flatMap((r) => {
    const kind = actionKindOf(r);
    return kind ? [{ key: kind, at: Date.parse(r.createdAt), what: r.what }] : [];
  });
  const kind = plusFrequent(comptes);
  if (!kind) return null;
  const what = plusFrequent(comptes.filter((c) => c.key === kind.key).map((c) => ({ key: c.what, at: c.at })));
  return { actionKind: kind.key, what: what?.key ?? "", count: kind.count };
}

/** Le plus grand résultat d'un jet de dégâts ; `null` sans dégâts. */
export function biggestHit(rolls: readonly StatsRoll[]): number | null {
  const degats = rolls.filter((r) => r.kind === "damage").map((r) => r.result);
  return degats.length > 0 ? Math.max(...degats) : null;
}

export interface PlayerFigures {
  n20: number;
  n1: number;
  spentGp: number;
  earnedGp: number;
  favorite: FavoriteAction | null;
}

/** Les moyennes des joueurs de la table (la joueuse comprise). */
export interface TableFigures {
  average20: number;
  average1: number;
}

export interface FamilyMeasures {
  luck: number;
  bad_luck: number;
  purse: number;
  favorite_action: ActionKind | null;
}

/** Un rapport à la table : 0 pour 0 vaut 1 (comme la table) ; quelque chose contre une table à 0 vaut l'infini. */
function rapport(mine: number, table: number): number {
  if (table === 0) return mine === 0 ? 1 : Infinity;
  return mine / table;
}

/**
 * Les mesures des quatre familles : chance et malchance = 20 (ou 1) de la
 * joueuse ÷ moyenne de la table ; bourse = dépensé ÷ gagné (rien gagné :
 * l'infini, sauf si rien n'a été dépensé non plus : 0).
 */
export function familyMeasures(mine: PlayerFigures, table: TableFigures): FamilyMeasures {
  return {
    luck: rapport(mine.n20, table.average20),
    bad_luck: rapport(mine.n1, table.average1),
    purse: mine.spentGp === 0 ? 0 : mine.earnedGp === 0 ? Infinity : mine.spentGp / mine.earnedGp,
    favorite_action: mine.favorite?.actionKind ?? null,
  };
}

/** Le palier d'une mesure : `range_from ≤ mesure < range_to` (`range_to` nul : sans borne) ; l'action favorite par sa nature. Aucun : `null`. */
export function pickTitle(tiers: readonly PlayerTitleTier[], family: TitleFamily, measure: number | ActionKind | null): PlayerTitleTier | null {
  if (measure === null) return null;
  const candidats = tiers.filter((t) => t.family === family);
  if (typeof measure === "string") return candidats.find((t) => t.action_kind === measure) ?? null;
  return candidats.find((t) => t.range_from !== null && t.range_from <= measure && (t.range_to === null || measure < t.range_to)) ?? null;
}

export type TemplateValues = Partial<Record<(typeof TITLE_TEMPLATE_VARIABLES)[number], string | number>>;

function texteDe(v: string | number): string {
  if (typeof v === "string") return v;
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 10) / 10).replace(".", ",");
}

/**
 * Le texte d'un titre : `{variable}` remplacée par sa valeur, en une seule
 * passe (une valeur n'est jamais relue comme gabarit). Une variable inconnue,
 * ou sans valeur, reste telle quelle. Texte brut : ni HTML, ni évaluation.
 */
export function renderTemplate(template: string, values: TemplateValues): string {
  return template.replace(/\{([^{}]*)\}/g, (brut, nom: string) => {
    if (!(TITLE_TEMPLATE_VARIABLES as readonly string[]).includes(nom)) return brut;
    const v = values[nom as keyof TemplateValues];
    return v === undefined ? brut : texteDe(v);
  });
}

export interface TierProblem {
  family: TitleFamily;
  kind: "gap" | "overlap";
  /** La plage en cause ; `to` nul : jusqu'à l'infini. Nuls pour une nature d'action en double. */
  from: number | null;
  to: number | null;
  actionKind?: ActionKind;
}

/**
 * Les trous et chevauchements des plages, pour l'avertissement de l'éditeur
 * (V3.1-92) : chaque famille chiffrée doit couvrir [0, ∞) sans recouvrement ;
 * l'action favorite, une nature au plus une fois.
 */
export function checkTiers(tiers: readonly PlayerTitleTier[]): TierProblem[] {
  const problemes: TierProblem[] = [];
  for (const family of TITLE_FAMILIES) {
    const siens = tiers.filter((t) => t.family === family);
    if (family === "favorite_action") {
      const vues = new Set<ActionKind>();
      for (const t of siens) {
        if (t.action_kind === null) continue;
        if (vues.has(t.action_kind)) problemes.push({ family, kind: "overlap", from: null, to: null, actionKind: t.action_kind });
        vues.add(t.action_kind);
      }
      continue;
    }
    const plages = siens
      .filter((t): t is PlayerTitleTier & { range_from: number } => t.range_from !== null)
      .sort((a, b) => a.range_from - b.range_from);
    if (plages.length === 0) continue;
    let fin: number | null = 0;
    for (const t of plages) {
      if (fin === null) {
        problemes.push({ family, kind: "overlap", from: t.range_from, to: t.range_to });
        continue;
      }
      if (t.range_from > fin) problemes.push({ family, kind: "gap", from: fin, to: t.range_from });
      else if (t.range_from < fin) problemes.push({ family, kind: "overlap", from: t.range_from, to: t.range_to === null ? fin : Math.min(fin, t.range_to) });
      fin = t.range_to === null ? null : Math.max(fin, t.range_to);
    }
    if (fin !== null) problemes.push({ family, kind: "gap", from: fin, to: null });
  }
  return problemes;
}

export interface PlayerTitle {
  family: TitleFamily;
  /** `null` : aucun palier ne convient, la case reste vide. */
  tier: PlayerTitleTier | null;
  text: string | null;
}

/**
 * Les quatre titres d'une joueuse, une case par famille (dans l'ordre des
 * familles) ; `[]` sous `MIN_D20_ROLLS` jets à d20.
 */
export function playerTitles(p: {
  rolls: readonly StatsRoll[];
  table: TableFigures;
  economy: { spentGp: number; earnedGp: number };
  tiers: readonly PlayerTitleTier[];
}): PlayerTitle[] {
  const histogramme = d20Histogram(p.rolls);
  if (histogramme.tooFew) return [];
  const favorite = favoriteAction(p.rolls);
  const figures: PlayerFigures = { n20: histogramme.counts[19], n1: histogramme.counts[0], spentGp: p.economy.spentGp, earnedGp: p.economy.earnedGp, favorite };
  const mesures = familyMeasures(figures, p.table);
  const record = biggestHit(p.rolls);
  const valeurs: TemplateValues = {
    n20: figures.n20,
    table20: p.table.average20,
    n1: figures.n1,
    suite: longestStreak(p.rolls, 1),
    depense: p.economy.spentGp,
    gagne: p.economy.earnedGp,
    ...(favorite ? { action: favorite.what, fois: favorite.count } : {}),
    ...(record !== null ? { record } : {}),
  };
  return TITLE_FAMILIES.map((family) => {
    const tier = pickTitle(p.tiers, family, mesures[family]);
    return { family, tier, text: tier ? renderTemplate(tier.template, valeurs) : null };
  });
}
