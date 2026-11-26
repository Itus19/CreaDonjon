import { SeededRng } from "../dice/rng";
import type { LifeArchetype, PlaceKind, RoutineSlot, SlotDays } from "./archetypes";
import { deriveSeed } from "./seed";

/**
 * V3.2-29 — Où est une personne, à un jour et une heure donnés
 * (`specs/vie-du-monde.md` §5, ADR 0115 point 1).
 *
 * Une fonction PURE de la graine, de l'archétype et du moment : rien n'est
 * simulé en continu, rien n'est stocké hors des exceptions (agenda, états).
 * Le même appel rend toujours la même réponse, ce qui permet de recalculer
 * la salle de l'auberge à n'importe quelle heure sans tic de fond
 * (`docs/QUOTAS.md`).
 *
 * L'ordre, du plus fort au plus faible :
 * 1. la mort ;
 * 2. un état (en prison, blessé, en fuite) : on ne tient pas un rendez-vous
 *    depuis une cellule ;
 * 3. l'agenda, qui écrase le séjour et la routine ;
 * 4. le séjour : une personne de passage hors de son séjour n'est pas en ville ;
 * 5. la routine de l'archétype, avec sa gigue et ses jours d'absence.
 */

/** Un instant du monde : un jour absolu (celui de `materializeOccupants`) et une heure de 0 à 23. */
export interface WorldInstant {
  day: number;
  hour: number;
}

/**
 * Le moment demandé. Le jour de semaine vient du calendrier du monde
 * (`weekdayIndexForDate`) ; sans semaine connue, tous les jours sont ouvrés
 * et aucun n'est jour de repos.
 */
export interface LifeMoment extends WorldInstant {
  weekday?: number | null;
  weekLength?: number;
}

/** Une exception datée (§5.1) : `where` est un lieu précis (clé de lieu ou entité), `to` exclu. */
export interface AgendaEntry {
  from: WorldInstant;
  to: WorldInstant;
  where: string;
  reason: string;
}

export type LifeConditionKind = "prison" | "injured" | "fled";

/** Ce qui empêche la routine pour un temps ; sans `to`, jusqu'à nouvel ordre. */
export interface LifeCondition {
  kind: LifeConditionKind;
  from: WorldInstant;
  to?: WorldInstant;
}

/**
 * La teinte de la psyché (§4.3) : un ajout aux probabilités par type de
 * lieu, borné à ±0,2 pour qu'un archétype reste reconnaissable. Absente,
 * neutre : V3.2-40 la calculera depuis les pôles et les centres d'intérêt.
 */
export type RoutineTint = Partial<Record<PlaceKind, number>>;
export const TINT_BOUND = 0.2;

export interface LifePerson {
  seed: number;
  archetype: LifeArchetype;
  /** Ses lieux à elle, par type ; un type absent donne une clé nulle. */
  places: Partial<Record<PlaceKind, string>>;
  diedAt?: WorldInstant;
  conditions?: readonly LifeCondition[];
  agenda?: readonly AgendaEntry[];
  /** Séjour d'une personne de passage, en jours : `fromDay` inclus, `toDay` exclu. */
  stay?: { fromDay: number; toDay: number };
  tint?: RoutineTint;
}

export type LifePosition =
  | { kind: "dead"; reason: "dead" }
  | { kind: "away"; reason: "stay" | "condition" }
  | { kind: "place"; where: PlaceKind | null; placeKey: string | null; reason: "agenda" | "condition" | "routine" };

const MINUTES_PER_DAY = 24 * 60;

function toHours(t: WorldInstant): number {
  return t.day * 24 + t.hour;
}

function properMod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

/** Un réel de [0, 1) tiré de la graine : toujours le même pour la même graine. */
function unit(seed: number): number {
  return new SeededRng(seed).nextInt(1_000_000) / 1_000_000;
}

function enPlace(person: LifePerson, where: PlaceKind, reason: "condition" | "routine"): LifePosition {
  return { kind: "place", where, placeKey: person.places[where] ?? null, reason };
}

function dayMatches(days: SlotDays, day: number, person: LifePerson, moment: LifeMoment): boolean {
  if (days === "all") return true;
  if (typeof days === "object") {
    const phase = deriveSeed(person.seed, "cycle", days.cycle) % days.cycle;
    return days.on.includes(properMod(day + phase, days.cycle));
  }
  const length = moment.weekLength ?? 0;
  if (moment.weekday === null || moment.weekday === undefined || length < 2) return days === "workdays";
  const weekday = properMod(moment.weekday - (moment.day - day), length);
  const isRestDay = weekday === length - 1;
  return days === "restday" ? isRestDay : !isRestDay;
}

/** Ce jour-là, la personne manque-t-elle à l'appel ? Tiré une fois par jour. */
function isAbsent(person: LifePerson, day: number): boolean {
  return unit(deriveSeed(person.seed, "absence", day)) < person.archetype.absence_days_per_10 / 10;
}

/** Le décalage de ses heures ce jour-là, en minutes, dans [-gigue, +gigue]. */
function jitter(person: LifePerson, day: number): number {
  const j = person.archetype.jitter_minutes;
  return j === 0 ? 0 : Math.round((unit(deriveSeed(person.seed, "jitter", day)) * 2 - 1) * j);
}

function chanceOf(slot: RoutineSlot, person: LifePerson): number {
  const raw = person.tint?.[slot.where] ?? 0;
  const tint = Math.max(-TINT_BOUND, Math.min(TINT_BOUND, raw));
  return Math.max(0, Math.min(1, slot.chance + tint));
}

/**
 * Le créneau `index` tenu le jour `day` couvre-t-il la minute `minute`
 * (comptée depuis le début de ce jour, donc au-delà de 1440 pour le
 * lendemain) ? Le tirage se fait une fois par jour et par créneau : un
 * pilier de bar qui va à la taverne y passe la soirée, il n'y clignote pas
 * d'heure en heure.
 */
function slotHolds(person: LifePerson, slot: RoutineSlot, index: number, day: number, minute: number, moment: LifeMoment): boolean {
  if (!dayMatches(slot.days, day, person, moment)) return false;
  const shift = jitter(person, day);
  const end = slot.to <= slot.from ? slot.to + 24 : slot.to;
  if (minute < slot.from * 60 + shift || minute >= end * 60 + shift) return false;
  return unit(deriveSeed(person.seed, "slot", day, index)) < chanceOf(slot, person);
}

function routine(person: LifePerson, moment: LifeMoment): LifePosition {
  const minute = moment.hour * 60 + 30;
  const slots = person.archetype.routine;
  // D'abord ce qui continue depuis la veille (la nuit de garde après minuit).
  if (!isAbsent(person, moment.day - 1)) {
    for (const [i, slot] of slots.entries()) {
      if (slotHolds(person, slot, i, moment.day - 1, minute + MINUTES_PER_DAY, moment)) return enPlace(person, slot.where, "routine");
    }
  }
  if (!isAbsent(person, moment.day)) {
    for (const [i, slot] of slots.entries()) {
      if (slotHolds(person, slot, i, moment.day, minute, moment)) return enPlace(person, slot.where, "routine");
    }
  }
  return enPlace(person, "home", "routine");
}

const CONDITION_PLACE: Record<LifeConditionKind, PlaceKind | "away"> = {
  prison: "prison",
  injured: "home",
  fled: "away",
};

export function position(person: LifePerson, moment: LifeMoment): LifePosition {
  if (!Number.isInteger(moment.hour) || moment.hour < 0 || moment.hour > 23) {
    throw new RangeError("L'heure doit être un entier de 0 à 23");
  }
  const now = toHours(moment);
  const during = (from: WorldInstant, to?: WorldInstant) => toHours(from) <= now && (to === undefined || now < toHours(to));

  if (person.diedAt && toHours(person.diedAt) <= now) return { kind: "dead", reason: "dead" };

  const condition = person.conditions?.find((c) => during(c.from, c.to));
  if (condition) {
    const where = CONDITION_PLACE[condition.kind];
    return where === "away" ? { kind: "away", reason: "condition" } : enPlace(person, where, "condition");
  }

  const rendezVous = person.agenda?.find((a) => during(a.from, a.to));
  if (rendezVous) return { kind: "place", where: null, placeKey: rendezVous.where, reason: "agenda" };

  if (person.stay && (moment.day < person.stay.fromDay || moment.day >= person.stay.toDay)) return { kind: "away", reason: "stay" };

  return routine(person, moment);
}
