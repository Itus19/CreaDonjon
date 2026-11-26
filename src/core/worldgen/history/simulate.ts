import { SeededRng } from "../../dice/rng";
import { deriveSeed } from "../seed";
import { stateNeighbors, type AbstractWorld } from "../world";

/**
 * Le simulateur d'histoire, couche 1 (specs/generation-du-monde.md §9,
 * ADR 0104 §7) : trois sortes d'événements, des fondations, des guerres et
 * des fins de règne, sur des siècles, au niveau des États et des villes,
 * jamais des individus.
 *
 * **Le présent est fixé.** La chronique aboutit au monde tel qu'il est :
 * chaque État existe à la fin, sa capitale est fondée avant ses autres
 * villes, les guerres imposées sont gardées telles quelles. Les guerres
 * inventées ne changent aucune frontière : les conquêtes viendront avec la
 * couche 3, qui saura les faire aboutir au présent.
 *
 * Pur et déterministe : même monde, même durée, même chronique. Un seul
 * générateur, dont l'ordre des tirages est celui du code ci-dessous (États,
 * villes, règnes, guerres) : le changer change toutes les chroniques.
 */

export type HistoryEvent =
  | { kind: "founding"; year: number; siteId: string; stateId: string | null; isStateFounding: boolean }
  | {
      kind: "war";
      year: number;
      /** `null` : toujours en cours au présent (seulement pour une guerre imposée). */
      endYear: number | null;
      attackers: string[];
      defenders: string[];
      /** Le nom imposé ; `null` pour une guerre inventée, nommée par ses camps à l'affichage. */
      name: string | null;
      imposed: boolean;
    }
  | { kind: "ruler_death"; year: number; stateId: string; rulerOrdinal: number };

export interface Chronicle {
  startYear: number;
  presentYear: number;
  events: HistoryEvent[];
  /** Événements écartés par le plafond. */
  dropped: number;
}

export interface HistoryOptions {
  /** Durée simulée, de 10 à 2 000 ans. */
  years: number;
  /** Plafond d'événements gardés (500 par défaut) : la base est limitée (docs/QUOTAS.md). */
  maxEvents?: number;
}

/** Les capitales naissent dans les premiers 15 % de la période. */
const CAPITAL_WINDOW = 0.15;
/** Un règne dure de 5 à 40 ans. */
const REIGN_MIN = 5;
const REIGN_SPREAD = 36;
/** Chaque année, une paire d'États voisins en paix entre en guerre avec une chance sur 80. */
const WAR_ODDS = 80;
/** Une guerre inventée dure de 1 à 8 ans. */
const WAR_SPREAD = 8;
const DEFAULT_MAX_EVENTS = 500;

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** Plus un événement compte pour la toile de fond, plus il résiste au plafond. */
function priority(event: HistoryEvent): number {
  if (event.kind === "war") return event.imposed ? 0 : 2;
  if (event.kind === "founding") return event.isStateFounding ? 0 : 3;
  return 4;
}

const KIND_ORDER: Record<HistoryEvent["kind"], number> = { founding: 0, war: 1, ruler_death: 2 };

export function simulateHistory(world: AbstractWorld, options: HistoryOptions): Chronicle {
  const { years } = options;
  if (!Number.isInteger(years) || years < 10 || years > 2_000) {
    throw new RangeError("La durée simulée doit être un entier de 10 à 2 000 ans");
  }
  const presentYear = world.presentYear;
  const startYear = presentYear - years;
  const rng = new SeededRng(deriveSeed(world.seed, "history", 1));
  const events: HistoryEvent[] = [];

  const imposedWars = world.anchors.filter((a) => a.startYear >= startYear);

  // 1. Les États naissent avec leur capitale, tôt, et toujours avant leur première guerre imposée.
  const stateFounded = new Map<string, number>();
  for (const state of world.states) {
    let year = startYear + rng.nextInt(Math.max(1, Math.floor(years * CAPITAL_WINDOW)));
    for (const war of imposedWars) {
      if (war.attackers.includes(state.id) || war.defenders.includes(state.id)) year = Math.min(year, war.startYear - 1);
    }
    year = Math.max(startYear, year);
    stateFounded.set(state.id, year);
    events.push({ kind: "founding", year, siteId: state.capitalSiteId, stateId: state.id, isStateFounding: true });
  }

  // 2. Les autres villes : les plus peuplées d'abord, toutes après leur capitale et avant le présent.
  const capitals = new Set(world.states.map((s) => s.capitalSiteId));
  const others = world.sites
    .filter((s) => !capitals.has(s.id))
    .sort((a, b) => b.settlement.population - a.settlement.population || a.id.localeCompare(b.id));
  others.forEach((site, rank) => {
    const earliest = site.stateId === null ? startYear : (stateFounded.get(site.stateId) ?? startYear) + 1;
    const latest = presentYear - 1;
    const span = Math.max(0, latest - earliest);
    const base = earliest + Math.floor((span * 0.8 * rank) / Math.max(1, others.length));
    const year = Math.min(latest, base + rng.nextInt(Math.floor(span * 0.2) + 1));
    events.push({ kind: "founding", year: Math.max(earliest, year), siteId: site.id, stateId: site.stateId, isStateFounding: false });
  });

  // 3. Les règnes se suivent dans chaque État, de sa fondation au présent.
  for (const state of world.states) {
    let year = stateFounded.get(state.id) ?? startYear;
    for (let ordinal = 1; ; ordinal++) {
      year += REIGN_MIN + rng.nextInt(REIGN_SPREAD);
      if (year >= presentYear) break;
      events.push({ kind: "ruler_death", year, stateId: state.id, rulerOrdinal: ordinal });
    }
  }

  // 4. Les guerres : d'abord celles que le présent impose, puis celles qu'on invente entre voisins.
  const busy = new Map<string, Array<[number, number]>>();
  const reserve = (a: string, b: string, from: number, to: number) => {
    const key = pairKey(a, b);
    busy.set(key, [...(busy.get(key) ?? []), [from, to]]);
  };
  for (const war of imposedWars) {
    events.push({
      kind: "war",
      year: war.startYear,
      endYear: war.endYear,
      attackers: [...war.attackers],
      defenders: [...war.defenders],
      name: war.name,
      imposed: true,
    });
    for (const a of war.attackers) for (const d of war.defenders) reserve(a, d, war.startYear, war.endYear ?? presentYear);
  }

  const neighbors = stateNeighbors(world);
  const pairs = [...new Set([...neighbors].flatMap(([a, set]) => [...set].map((b) => pairKey(a, b))))].sort();
  const overlaps = (key: string, from: number, to: number) =>
    (busy.get(key) ?? []).some(([f, t]) => from <= t && to >= f);

  for (let year = startYear; year < presentYear; year++) {
    for (const key of pairs) {
      const [a, b] = key.split("|");
      if ((stateFounded.get(a) ?? Infinity) > year || (stateFounded.get(b) ?? Infinity) > year) continue;
      if (overlaps(key, year, year)) continue;
      if (rng.nextInt(WAR_ODDS) !== 0) continue;
      const endYear = year + rng.nextInt(WAR_SPREAD);
      const attackerFirst = rng.nextInt(2) === 0;
      if (endYear >= presentYear || overlaps(key, year, endYear)) continue;
      reserve(a, b, year, endYear);
      events.push({
        kind: "war",
        year,
        endYear,
        attackers: [attackerFirst ? a : b],
        defenders: [attackerFirst ? b : a],
        name: null,
        imposed: false,
      });
    }
  }

  // 5. Le plafond, puis l'ordre chronologique.
  const maxEvents = options.maxEvents ?? DEFAULT_MAX_EVENTS;
  const indexed = events.map((event, index) => ({ event, index }));
  const kept = [...indexed]
    .sort((x, y) => priority(x.event) - priority(y.event) || x.index - y.index)
    .slice(0, maxEvents)
    .sort((x, y) => x.event.year - y.event.year || KIND_ORDER[x.event.kind] - KIND_ORDER[y.event.kind] || x.index - y.index)
    .map((x) => x.event);

  return { startYear, presentYear, events: kept, dropped: events.length - kept.length };
}
