import { SeededRng, type Rng } from "../dice/rng";
import type { SettlementBlockData, SettlementShare, SettlementWealth, SettlementZone } from "../schemas/blocks/settlement";
import { archetypeParCle, type PlaceKind } from "./archetypes";
import { position, type LifeMoment } from "./position";
import { deriveSeed } from "./seed";

/**
 * Les gens d'un lieu (ADR 0104 §3, ADR 0115, specs/vie-du-monde.md §3 et §5,
 * specs/generation-du-monde.md §4.2) : qui est attaché à l'auberge de cette
 * ville, et qui s'y trouve à cette heure, calculé à partir des agrégats de la
 * ville sans rien stocker.
 *
 * Deux étages :
 * - `attachedPeople` : les gens attachés au lieu ce jour-là. Personnel et
 *   habitués ne changent jamais ; logés et gens de passage ont un séjour tiré
 *   par semaine, puis repartent.
 * - `materializeOccupants` : ceux d'entre eux que `position()` place dans le
 *   lieu à cette heure, plus les clients d'un soir qui ne reviendront pas.
 *
 * Chaque personne a sa propre graine, dérivée de la graine de la ville, du
 * lieu, de son attache et de son rang (`deriveSeed`) : revenir dans le même
 * lieu redonne les mêmes gens.
 *
 * Ce noyau ne lit pas le wiki : le service appelant lui passe les PNJ reliés
 * au lieu par `works_at` (`workers`), qui prennent la place des occupants
 * tirés du personnel, dans l'ordre (décision 4 de la spec).
 */

export const OCCUPANT_PLACE_TYPES = ["inn", "tavern", "temple", "market", "barracks", "workshop", "hermitage"] as const;
export type OccupantPlaceType = (typeof OCCUPANT_PLACE_TYPES)[number];

export interface OccupantPlace {
  /** Identifiant stable du lieu, en pratique l'id de son entité. */
  key: string;
  type: OccupantPlaceType;
}

/** Le moment demandé : jour absolu, heure de 0 à 23, jour de semaine facultatif (voir `LifeMoment`). */
export type OccupantMoment = LifeMoment;

/**
 * L'attache d'une personne au lieu (§3). Le personnel se divise entre le
 * responsable (`head` : l'aubergiste, le prêtre, l'ermite) et les autres.
 * `patron` est le client d'un soir, qui n'est attaché à rien.
 */
export type OccupantRole = "head" | "staff" | "regular" | "lodger" | "passing" | "patron";
export type AgeBand = "young" | "adult" | "elder";

export interface Occupant {
  role: OccupantRole;
  /** Rang dans le rôle, à partir de 0 : le deuxième habitué a le rang 1. */
  rank: number;
  /** Graine propre, pour `position()` et les tables du générateur PNJ (nom, apparence). */
  seed: number;
  /** Clé de peuple tirée selon `settlement.peoples`, `null` si la ville n'en déclare aucun. */
  people: string | null;
  /** Clé de métier : fixe pour le personnel, tirée selon `settlement.trades` pour les autres. */
  trade: string | null;
  ageBand: AgeBand;
  /** Clé d'archétype de vie (`archetypes.ts`). */
  archetype: string;
  /** Les lieux de la personne qui sont CE lieu ; ses autres lieux sont ailleurs en ville. */
  places: Partial<Record<PlaceKind, string>>;
  /** Séjour d'un logé ou d'une personne de passage : `fromDay` inclus, `toDay` exclu. */
  stay?: { fromDay: number; toDay: number };
  /** L'entité du wiki qui tient cette place (`works_at`). */
  entityId?: string;
}

/** Une personne présente, et le type de lieu où `position()` la met (`home` : dans ses quartiers ; `null` : un rendez-vous d'agenda). */
export interface PresentOccupant extends Occupant {
  at: PlaceKind | null;
}

/** Un PNJ du wiki relié au lieu par `works_at`, avec l'archétype de sa fiche s'il en a un. */
export interface WikiWorker {
  entityId: string;
  archetype?: string;
}

/** Plafond des gens attachés tirés (décision 6) ; les PNJ du wiki passent au-dessus, le wiki l'emporte. */
export const ATTACHED_MAX = 12;

type ByZone = Record<SettlementZone, number>;
type ArchetypePool = readonly SettlementShare[];

/**
 * Le gabarit de peuplement d'un type de lieu (§3). `kind` dit ce qu'est le
 * lieu pour qui y vient (une taverne pour les habitués d'une auberge) ;
 * le personnel y a aussi son travail. `headLives` : le responsable dort sur
 * place (l'aubergiste, l'ermite).
 */
interface PlaceTemplate {
  kind: PlaceKind;
  head: { trade: string; archetype: string; lives: boolean } | null;
  staff: { trade: string; archetype: string; max: Record<SettlementWealth, number> } | null;
  regulars: { count: ByZone; pool: ArchetypePool };
  lodgers: ByZone;
  passing: { count: ByZone; pool: ArchetypePool };
}

const NONE: ByZone = { bourg: 0, ville: 0, capitale: 0 };
const NO_POOL: ArchetypePool = [];

const TAVERN_REGULARS: ArchetypePool = [
  { key: "pilier_de_bar", share: 3 },
  { key: "joueur", share: 2 },
  { key: "journalier", share: 2 },
  { key: "artisan", share: 2 },
  { key: "vieillard", share: 1 },
  { key: "malfrat", share: 1 },
];
const TRAVELLERS: ArchetypePool = [
  { key: "marchand_ambulant", share: 3 },
  { key: "messager", share: 2 },
  { key: "pelerin", share: 1 },
  { key: "voyageur", share: 2 },
];

const TEMPLATES: Record<OccupantPlaceType, PlaceTemplate> = {
  inn: {
    kind: "tavern",
    head: { trade: "innkeeper", archetype: "personnel_de_lieu", lives: true },
    staff: { trade: "inn_staff", archetype: "personnel_de_lieu", max: { modeste: 1, correcte: 2, reputee: 3 } },
    regulars: { count: { bourg: 2, ville: 3, capitale: 3 }, pool: TAVERN_REGULARS },
    lodgers: { bourg: 1, ville: 2, capitale: 4 },
    passing: { count: { bourg: 0, ville: 1, capitale: 2 }, pool: TRAVELLERS },
  },
  tavern: {
    kind: "tavern",
    head: { trade: "tavern_keeper", archetype: "personnel_de_lieu", lives: true },
    staff: { trade: "inn_staff", archetype: "personnel_de_lieu", max: { modeste: 1, correcte: 2, reputee: 3 } },
    regulars: { count: { bourg: 3, ville: 5, capitale: 6 }, pool: TAVERN_REGULARS },
    lodgers: NONE,
    passing: { count: { bourg: 0, ville: 1, capitale: 2 }, pool: TRAVELLERS },
  },
  temple: {
    kind: "temple",
    head: { trade: "priest", archetype: "pretre", lives: true },
    staff: { trade: "acolyte", archetype: "pretre", max: { modeste: 1, correcte: 1, reputee: 2 } },
    regulars: {
      count: { bourg: 2, ville: 3, capitale: 4 },
      pool: [
        { key: "vieillard", share: 3 },
        { key: "artisan", share: 1 },
        { key: "noble", share: 1 },
      ],
    },
    lodgers: NONE,
    passing: { count: { bourg: 0, ville: 1, capitale: 3 }, pool: [{ key: "pelerin", share: 1 }] },
  },
  market: {
    kind: "market",
    head: null,
    staff: { trade: "merchant", archetype: "marchand_etabli", max: { modeste: 2, correcte: 4, reputee: 6 } },
    regulars: {
      count: { bourg: 1, ville: 2, capitale: 3 },
      pool: [
        { key: "enfant", share: 2 },
        { key: "vieillard", share: 1 },
        { key: "malfrat", share: 1 },
      ],
    },
    lodgers: NONE,
    passing: { count: { bourg: 1, ville: 2, capitale: 3 }, pool: [{ key: "marchand_ambulant", share: 1 }] },
  },
  barracks: {
    kind: "barracks",
    head: { trade: "sergeant", archetype: "garde", lives: false },
    staff: { trade: "guard", archetype: "garde", max: { modeste: 2, correcte: 4, reputee: 6 } },
    regulars: { count: NONE, pool: NO_POOL },
    lodgers: NONE,
    passing: { count: { bourg: 0, ville: 1, capitale: 1 }, pool: [{ key: "messager", share: 1 }] },
  },
  workshop: {
    kind: "work",
    head: { trade: "artisan", archetype: "artisan", lives: true },
    staff: { trade: "apprentice", archetype: "artisan", max: { modeste: 1, correcte: 1, reputee: 2 } },
    regulars: { count: NONE, pool: NO_POOL },
    lodgers: NONE,
    passing: { count: NONE, pool: NO_POOL },
  },
  hermitage: {
    kind: "home",
    head: { trade: "hermit", archetype: "personnel_de_lieu", lives: true },
    staff: null,
    regulars: { count: NONE, pool: NO_POOL },
    lodgers: NONE,
    passing: { count: NONE, pool: NO_POOL },
  },
};

const AGE_BANDS: readonly SettlementShare[] = [
  { key: "young", share: 25 },
  { key: "adult", share: 60 },
  { key: "elder", share: 15 },
];

/** Un archétype qui fixe l'âge : un enfant est jeune, un vieillard âgé. */
const AGE_OF_ARCHETYPE: Partial<Record<string, AgeBand>> = { enfant: "young", vieillard: "elder" };

const DAYS_PER_WEEK = 7;

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
 * métier (hors personnel), archétype (s'il se tire), tranche d'âge.
 */
function personFrom(
  settlement: SettlementBlockData,
  role: OccupantRole,
  rank: number,
  seed: number,
  fixed: { trade: string | null; archetype: string | null; pool?: ArchetypePool },
  places: Partial<Record<PlaceKind, string>>
): Occupant {
  const rng = new SeededRng(seed);
  const people = pickWeighted(settlement.peoples, rng);
  const trade = fixed.trade ?? pickWeighted(settlement.trades, rng);
  const archetype = fixed.archetype ?? pickWeighted(fixed.pool ?? NO_POOL, rng) ?? "voyageur";
  const drawnAge = pickWeighted(AGE_BANDS, rng) as AgeBand;
  return { role, rank, seed, people, trade, ageBand: AGE_OF_ARCHETYPE[archetype] ?? drawnAge, archetype, places };
}

/**
 * Le séjour d'un logé ou d'une personne de passage, tiré pour sa semaine :
 * la chambre ou la place est-elle prise cette semaine, quel jour on arrive,
 * combien de jours on reste. Un séjour ne déborde pas sur la semaine
 * suivante, où une autre personne prend la place : c'est ce qui garantit
 * qu'on ne se retrouve pas à deux dans la même chambre.
 */
function stayFor(city: number, placeKey: string, role: OccupantRole, week: number, rank: number, maxDays: number): { fromDay: number; toDay: number } | null {
  const rng = new SeededRng(deriveSeed(city, placeKey, role, "stay", week, rank));
  if (rng.nextInt(10) >= 7) return null;
  const fromDay = week * DAYS_PER_WEEK + rng.nextInt(DAYS_PER_WEEK);
  const toDay = Math.min(fromDay + between(1, maxDays, rng), (week + 1) * DAYS_PER_WEEK);
  return { fromDay, toDay };
}

/**
 * Combien de gens tirés pour chaque attache, sous le plafond : on retire
 * d'abord des gens de passage, puis des logés, puis des habitués. Le
 * personnel n'est jamais retiré.
 */
function fitUnderCap(staff: number, counts: { regular: number; lodger: number; passing: number }, room: number) {
  const fitted = { ...counts };
  let over = staff + fitted.regular + fitted.lodger + fitted.passing - room;
  for (const key of ["passing", "lodger", "regular"] as const) {
    const cut = Math.min(Math.max(over, 0), fitted[key]);
    fitted[key] -= cut;
    over -= cut;
  }
  return fitted;
}

export function attachedPeople(settlement: SettlementBlockData, place: OccupantPlace, day: number, workers: readonly WikiWorker[] = []): Occupant[] {
  if (settlement.population === 0) return [];
  const template = TEMPLATES[place.type];
  const city = settlement.seed;
  const zone = settlement.zone;
  const here = place.key;
  const people: Occupant[] = [];

  if (template.head) {
    const places = { work: here, [template.kind]: here, ...(template.head.lives ? { home: here } : {}) };
    people.push(personFrom(settlement, "head", 0, deriveSeed(city, here, "head", 0), { trade: template.head.trade, archetype: template.head.archetype }, places));
  }
  if (template.staff) {
    const count = between(1, template.staff.max[settlement.wealth], new SeededRng(deriveSeed(city, here, "staff", "count")));
    for (let rank = 0; rank < count; rank++) {
      const places = { work: here, [template.kind]: here };
      people.push(personFrom(settlement, "staff", rank, deriveSeed(city, here, "staff", rank), { trade: template.staff.trade, archetype: template.staff.archetype }, places));
    }
  }

  // Les PNJ du wiki prennent les places du personnel dans l'ordre ; en surnombre, ils s'ajoutent.
  const staffSlots = people.length;
  for (const [i, worker] of workers.entries()) {
    const archetype = worker.archetype && archetypeParCle(worker.archetype) ? worker.archetype : null;
    if (i < staffSlots) {
      people[i] = { ...people[i], entityId: worker.entityId, ...(archetype ? { archetype } : {}) };
    } else {
      const rank = people.filter((p) => p.role === "staff").length;
      const fallback = template.staff?.archetype ?? template.head?.archetype ?? "personnel_de_lieu";
      const base = personFrom(settlement, "staff", rank, deriveSeed(city, here, "staff", rank), { trade: template.staff?.trade ?? null, archetype: archetype ?? fallback }, { work: here, [template.kind]: here });
      people.push({ ...base, entityId: worker.entityId });
    }
  }

  const fitted = fitUnderCap(people.length, { regular: template.regulars.count[zone], lodger: template.lodgers[zone], passing: template.passing.count[zone] }, ATTACHED_MAX);

  for (let rank = 0; rank < fitted.regular; rank++) {
    people.push(personFrom(settlement, "regular", rank, deriveSeed(city, here, "regular", rank), { trade: null, archetype: null, pool: template.regulars.pool }, { [template.kind]: here }));
  }

  const week = Math.floor(day / DAYS_PER_WEEK);
  const visitors: { role: "lodger" | "passing"; count: number; maxDays: number; pool: ArchetypePool; places: Partial<Record<PlaceKind, string>> }[] = [
    { role: "lodger", count: fitted.lodger, maxDays: 6, pool: [{ key: "voyageur", share: 1 }], places: { home: here, [template.kind]: here } },
    { role: "passing", count: fitted.passing, maxDays: 4, pool: template.passing.pool, places: { [template.kind]: here } },
  ];
  for (const v of visitors) {
    for (let rank = 0; rank < v.count; rank++) {
      const stay = stayFor(city, here, v.role, week, rank, v.maxDays);
      if (!stay || day < stay.fromDay || day >= stay.toDay) continue;
      const seed = deriveSeed(city, here, v.role, week, rank);
      people.push({ ...personFrom(settlement, v.role, rank, seed, { trade: null, archetype: null, pool: v.pool }, v.places), stay });
    }
  }

  return people;
}

/** Les clients d'un soir candidats par jour, selon la taille de la ville. */
const PATRONS_PER_DAY: ByZone = { bourg: 3, ville: 6, capitale: 10 };

/** Poids de l'heure d'arrivée d'un client d'un soir : peu la nuit, beaucoup le soir. */
const PATRON_ARRIVAL: readonly number[] = [1, 0, 0, 0, 0, 0, 1, 2, 2, 2, 3, 4, 5, 4, 3, 3, 4, 6, 9, 10, 9, 6, 3, 2];

/** Les lieux où passent des clients d'un soir. */
const HAS_PATRONS: ReadonlySet<OccupantPlaceType> = new Set(["inn", "tavern"]);

/**
 * Les clients d'un soir présents à cette heure : chacun a son heure
 * d'arrivée et reste une à trois heures, tirées avec le jour. Ils ne
 * reviendront pas (la graine change avec le jour).
 */
function patronsAt(settlement: SettlementBlockData, place: OccupantPlace, moment: OccupantMoment): Occupant[] {
  if (settlement.population === 0 || !HAS_PATRONS.has(place.type)) return [];
  const arrivals = PATRON_ARRIVAL.map((share, hour) => ({ key: String(hour), share })).filter((h) => h.share > 0);
  const patrons: Occupant[] = [];
  for (let i = 0; i < PATRONS_PER_DAY[settlement.zone]; i++) {
    const seed = deriveSeed(settlement.seed, place.key, "patron", moment.day, i);
    const rng = new SeededRng(deriveSeed(seed, "visit"));
    const from = Number(pickWeighted(arrivals, rng));
    const hours = between(1, 3, rng);
    if (moment.hour < from || moment.hour >= from + hours) continue;
    patrons.push(personFrom(settlement, "patron", patrons.length, seed, { trade: null, archetype: "voyageur" }, {}));
  }
  return patrons;
}

/**
 * Qui est dans le lieu à cette heure : les gens attachés que `position()`
 * place ici, plus les clients d'un soir. Une personne de passage arrivée la
 * veille dort encore à l'auberge ; le sergent est dans la rue pendant son
 * tour de garde, pas à la caserne.
 */
export function materializeOccupants(settlement: SettlementBlockData, place: OccupantPlace, moment: OccupantMoment, workers: readonly WikiWorker[] = []): PresentOccupant[] {
  if (!Number.isInteger(moment.hour) || moment.hour < 0 || moment.hour > 23) {
    throw new RangeError("L'heure doit être un entier de 0 à 23");
  }
  const present: PresentOccupant[] = [];
  for (const o of attachedPeople(settlement, place, moment.day, workers)) {
    const archetype = archetypeParCle(o.archetype);
    if (!archetype) continue;
    const where = position({ seed: o.seed, archetype, places: o.places, ...(o.stay ? { stay: o.stay } : {}) }, moment);
    if (where.kind === "place" && where.placeKey === place.key) present.push({ ...o, at: where.where });
  }
  return [...present, ...patronsAt(settlement, place, moment).map((o) => ({ ...o, at: TEMPLATES[place.type].kind }))];
}
