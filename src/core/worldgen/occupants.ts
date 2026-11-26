import { SeededRng, type Rng } from "../dice/rng";
import type {
  SettlementBlockData,
  SettlementShare,
  SettlementWealth,
  SettlementZone,
} from "../schemas/blocks/settlement";
import { deriveSeed } from "./seed";

/**
 * La matérialisation des personnes d'un lieu (ADR 0104 §3,
 * specs/generation-du-monde.md §4.2) : qui se trouve dans l'auberge de cette
 * ville, à ce moment, calculé à partir des agrégats de la ville et sans rien
 * stocker.
 *
 * Chaque personne a sa propre graine, dérivée de la graine de la ville, du
 * lieu, du rôle et du rang (`deriveSeed`). Revenir dans le même lieu redonne
 * donc les mêmes gens. Les clients changent avec le jour et le moment de la
 * journée ; l'aubergiste et le personnel, jamais.
 *
 * Ce noyau ne sait rien du wiki : quand une personne a été écrite dans le
 * wiki (`promoteSketch`), c'est au service appelant de la substituer à
 * l'occupant de même rôle et même rang (ticket G-4).
 */

/** Un seul type de lieu tant que la tranche « ville + auberge » n'en demande pas d'autre (règle des trois). */
export type OccupantPlaceType = "inn";

export interface OccupantPlace {
  /** Identifiant stable du lieu, en pratique l'id de son entité. */
  key: string;
  type: OccupantPlaceType;
}

export interface OccupantMoment {
  /** Jour de jeu, compté depuis n'importe quelle origine fixe. */
  day: number;
  /** Heure de 0 à 23. */
  hour: number;
}

export type DayPeriod = "night" | "morning" | "afternoon" | "evening";
export type OccupantRole = "innkeeper" | "staff" | "patron";
export type AgeBand = "young" | "adult" | "elder";

export interface Occupant {
  role: OccupantRole;
  /** Rang dans le rôle, à partir de 0 : le deuxième client a le rang 1. */
  rank: number;
  /** Graine propre, pour les tables du générateur PNJ (nom, apparence). */
  seed: number;
  /** Clé de peuple tirée selon `settlement.peoples`, `null` si la ville n'en déclare aucun. */
  people: string | null;
  /** Clé de métier : fixe pour l'aubergiste et le personnel, tirée selon `settlement.trades` pour un client. */
  trade: string | null;
  ageBand: AgeBand;
}

export function dayPeriod(hour: number): DayPeriod {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new RangeError("L'heure doit être un entier de 0 à 23");
  }
  if (hour < 6) return "night";
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

/** Plafond du personnel selon la richesse : une auberge modeste n'a qu'une personne pour servir. */
const STAFF_MAX: Record<SettlementWealth, number> = { modeste: 1, correcte: 2, reputee: 3 };

/** Clients avant multiplication, selon le moment : [minimum, maximum]. */
const PATRONS_BY_PERIOD: Record<DayPeriod, readonly [number, number]> = {
  night: [0, 1],
  morning: [0, 2],
  afternoon: [1, 3],
  evening: [2, 5],
};

/** Plus la ville est grande, plus la salle est pleine. */
const PATRON_FACTOR: Record<SettlementZone, number> = { bourg: 1, ville: 2, capitale: 3 };

const AGE_BANDS: readonly SettlementShare[] = [
  { key: "young", share: 25 },
  { key: "adult", share: 60 },
  { key: "elder", share: 15 },
];

/** Tire une clé selon les poids. `null` pour une liste vide. */
function pickWeighted(list: readonly SettlementShare[], rng: Rng): string | null {
  const total = list.reduce((sum, item) => sum + item.share, 0);
  if (total === 0) return null;
  let roll = rng.nextInt(total);
  for (const item of list) {
    if (roll < item.share) return item.key;
    roll -= item.share;
  }
  return null;
}

/** Entier de `min` à `max` inclus. */
function between(min: number, max: number, rng: Rng): number {
  return min + rng.nextInt(max - min + 1);
}

/**
 * Une personne à partir de sa graine. Ordre des tirages, à ne pas changer
 * sans accepter que les mêmes graines rendent d'autres gens : peuple,
 * métier (client seulement), tranche d'âge.
 */
function occupantFrom(
  settlement: SettlementBlockData,
  role: OccupantRole,
  rank: number,
  seed: number,
  fixedTrade: string | null
): Occupant {
  const rng = new SeededRng(seed);
  const people = pickWeighted(settlement.peoples, rng);
  const trade = role === "patron" ? pickWeighted(settlement.trades, rng) : fixedTrade;
  const ageBand = pickWeighted(AGE_BANDS, rng) as AgeBand;
  return { role, rank, seed, people, trade, ageBand };
}

export function materializeOccupants(
  settlement: SettlementBlockData,
  place: OccupantPlace,
  moment: OccupantMoment
): Occupant[] {
  const period = dayPeriod(moment.hour);
  if (settlement.population === 0) return [];

  const city = settlement.seed;
  const occupants: Occupant[] = [];

  occupants.push(occupantFrom(settlement, "innkeeper", 0, deriveSeed(city, place.key, "innkeeper", 0), "innkeeper"));

  const staffCount = between(1, STAFF_MAX[settlement.wealth], new SeededRng(deriveSeed(city, place.key, "staff", "count")));
  for (let rank = 0; rank < staffCount; rank++) {
    occupants.push(occupantFrom(settlement, "staff", rank, deriveSeed(city, place.key, "staff", rank), "inn_staff"));
  }

  const [min, max] = PATRONS_BY_PERIOD[period];
  const patronRng = new SeededRng(deriveSeed(city, place.key, "patron", "count", moment.day, period));
  const patronCount = between(min, max, patronRng) * PATRON_FACTOR[settlement.zone];
  for (let rank = 0; rank < patronCount; rank++) {
    const seed = deriveSeed(city, place.key, "patron", moment.day, period, rank);
    occupants.push(occupantFrom(settlement, "patron", rank, seed, null));
  }

  return occupants;
}
