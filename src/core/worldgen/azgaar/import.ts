import { z } from "zod";
import { BIOMES } from "../biomes";
import { deriveSeed } from "../seed";
import type { SettlementWealth, SettlementZone } from "../../schemas/blocks/settlement";
import type { AbstractWorld, WorldLink, WorldSite, WorldState, WorldWarAnchor } from "../world";

/**
 * La lecture d'un export « Complet » d'Azgaar's Fantasy Map Generator (MIT)
 * vers un monde abstrait (specs/generation-du-monde.md §8, ticket G-7).
 *
 * Pur : le fichier arrive déjà lu, rien n'est écrit. Chaque partie importe sa
 * propre carte ; rien ici ne suppose une carte particulière. Seuls les champs
 * dont le monde abstrait a besoin sont validés, le reste du fichier (7 Mo pour
 * une carte moyenne) est ignoré.
 *
 * Lu et testé sur Azgaar 1.159.0. Une version plus ancienne que 1.100 n'a pas
 * le même format de routes : elle est refusée avec un message clair.
 */

const MIN_VERSION: readonly [number, number] = [1, 100];

const zAzgaarCell = z.object({ biome: z.number().int().min(0), burg: z.number().int().min(0) });

const zAzgaarBurg = z.object({
  i: z.number().int(),
  name: z.string(),
  cell: z.number().int().min(0),
  x: z.number(),
  y: z.number(),
  state: z.number().int().min(0),
  culture: z.number().int().min(0),
  capital: z.number().int().optional(),
  population: z.number().min(0),
  group: z.string().optional(),
  removed: z.boolean().optional(),
});

const zAzgaarState = z.object({
  i: z.number().int(),
  name: z.string(),
  capital: z.number().int().optional(),
  culture: z.number().int().optional(),
  removed: z.boolean().optional(),
});

const zAzgaarCulture = z.object({ i: z.number().int(), name: z.string(), removed: z.boolean().optional() });

const zAzgaarRoute = z.object({
  group: z.string(),
  /** Chaque point : [x, y, cellule]. */
  points: z.array(z.tuple([z.number(), z.number(), z.number().int()]).rest(z.unknown())),
});

const zAzgaarEvent = z.object({
  i: z.number().int(),
  type: z.string(),
  name: z.string().optional(),
  start: z.union([z.string(), z.number()]).optional(),
  end: z.union([z.string(), z.number()]).optional(),
  attackers: z.array(z.number().int()).optional(),
  defenders: z.array(z.number().int()).optional(),
});

export const zAzgaarExport = z.object({
  info: z.object({ version: z.string(), seed: z.union([z.string(), z.number()]), mapName: z.string().optional() }),
  settings: z.object({
    populationRate: z.number().positive(),
    distanceScale: z.number().positive(),
    options: z
      .object({ map: z.object({ lore: z.object({ calendar: z.object({ year: z.number().int() }).optional() }).nullish() }).optional() })
      .optional(),
  }),
  pack: z.object({
    cells: z.array(zAzgaarCell).min(1),
    cultures: z.array(zAzgaarCulture),
    /** Azgaar met un `0` à la place de la ville 0. */
    burgs: z.array(z.union([z.literal(0), zAzgaarBurg])),
    states: z.array(zAzgaarState),
    routes: z.array(zAzgaarRoute).default([]),
    events: z.array(zAzgaarEvent).default([]),
  }),
});
export type AzgaarExport = z.infer<typeof zAzgaarExport>;

const LINK_KIND: Record<string, WorldLink["kind"]> = { roads: "road", trails: "trail", searoutes: "sea" };

function checkVersion(version: string): void {
  const [major, minor] = version.split(".").map(Number);
  const tooOld = !Number.isInteger(major) || !Number.isInteger(minor) || major < MIN_VERSION[0] || (major === MIN_VERSION[0] && minor < MIN_VERSION[1]);
  if (tooOld) throw new Error(`Cette carte vient d'Azgaar ${version} ; seules les versions ${MIN_VERSION.join(".")} et suivantes sont lues.`);
}

function worldSeed(raw: string | number): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 && n <= 0xffffffff ? n : deriveSeed(0, String(raw));
}

/**
 * Le rang d'une ville : capitale si Azgaar le dit, sinon d'après son groupe
 * (city et town sont des villes, village et fort des bourgs), sinon d'après
 * sa population.
 */
function zoneOf(capital: boolean, group: string | undefined, population: number): SettlementZone {
  if (capital) return "capitale";
  if (group === "city" || group === "town") return "ville";
  if (group === "village" || group === "fort") return "bourg";
  return population >= 2_000 ? "ville" : "bourg";
}

/** La richesse, faute de mieux d'après la population : Azgaar ne donne pas de richesse par ville. */
function wealthOf(population: number): SettlementWealth {
  if (population >= 20_000) return "reputee";
  if (population >= 2_000) return "correcte";
  return "modeste";
}

function yearOf(raw: string | number | undefined): number | null {
  if (raw === undefined || raw === "") return null;
  const n = Number(raw);
  return Number.isInteger(n) ? n : null;
}

export function azgaarToAbstractWorld(map: AzgaarExport): AbstractWorld {
  checkVersion(map.info.version);
  const seed = worldSeed(map.info.seed);
  const { pack, settings } = map;

  const cultures = pack.cultures.filter((c) => c.i !== 0 && !c.removed).map((c) => ({ id: `c-${c.i}`, name: c.name }));
  const cultureIds = new Set(cultures.map((c) => c.id));
  const cultureId = (i: number | undefined) => (i !== undefined && cultureIds.has(`c-${i}`) ? `c-${i}` : null);

  const liveStates = pack.states.filter((s) => s.i !== 0 && !s.removed);
  const stateIds = new Set(liveStates.map((s) => `s-${s.i}`));
  const stateId = (i: number) => (stateIds.has(`s-${i}`) ? `s-${i}` : null);

  const burgs = pack.burgs.filter((b): b is z.infer<typeof zAzgaarBurg> => b !== 0 && b.i !== 0 && !b.removed);
  const sites: WorldSite[] = burgs.map((b) => {
    const population = Math.round(b.population * settings.populationRate);
    const biome = BIOMES[pack.cells[b.cell]?.biome ?? -1] ?? "grassland";
    return {
      id: `b-${b.i}`,
      name: b.name,
      stateId: stateId(b.state),
      cultureId: cultureId(b.culture),
      notable: b.capital === 1 || b.group === "city",
      settlement: {
        __v: 1,
        seed: deriveSeed(seed, "burg", b.i),
        population,
        zone: zoneOf(b.capital === 1, b.group, population),
        wealth: wealthOf(population),
        biome,
        peoples: [],
        trades: [],
      },
    };
  });
  const siteIds = new Set(sites.map((s) => s.id));
  const burgById = new Map(burgs.map((b) => [b.i, b]));

  const states: WorldState[] = liveStates
    .filter((s) => s.capital !== undefined && burgById.get(s.capital)?.state === s.i)
    .map((s) => ({ id: `s-${s.i}`, name: s.name, cultureId: cultureId(s.culture), capitalSiteId: `b-${s.capital}` }));
  const keptStates = new Set(states.map((s) => s.id));
  for (const site of sites) if (site.stateId !== null && !keptStates.has(site.stateId)) site.stateId = null;

  // Les routes : deux villes qui se suivent sur un tracé sont reliées ; la distance suit le tracé.
  const links = new Map<string, WorldLink>();
  for (const route of pack.routes) {
    const kind = LINK_KIND[route.group];
    if (!kind) continue;
    let previous: string | null = null;
    let travelled = 0;
    route.points.forEach((point, index) => {
      if (index > 0) {
        const before = route.points[index - 1];
        travelled += Math.hypot(point[0] - before[0], point[1] - before[1]);
      }
      const burg = pack.cells[point[2]]?.burg ?? 0;
      const here = burg !== 0 && siteIds.has(`b-${burg}`) ? `b-${burg}` : null;
      if (here === null) return;
      if (previous !== null && previous !== here) {
        const [a, b] = previous < here ? [previous, here] : [here, previous];
        const distanceKm = Math.round(travelled * settings.distanceScale * 10) / 10;
        const key = `${a}|${b}`;
        const known = links.get(key);
        if (distanceKm > 0 && (!known || distanceKm < known.distanceKm)) links.set(key, { a, b, distanceKm, kind });
      }
      previous = here;
      travelled = 0;
    });
  }

  const presentYear = settings.options?.map?.lore?.calendar?.year ?? Math.max(0, ...pack.events.map((e) => yearOf(e.start) ?? 0));

  const anchors: WorldWarAnchor[] = pack.events.flatMap((e) => {
    if (e.type !== "war") return [];
    const startYear = yearOf(e.start);
    const attackers = (e.attackers ?? []).map((i) => `s-${i}`).filter((id) => keptStates.has(id));
    const defenders = (e.defenders ?? []).map((i) => `s-${i}`).filter((id) => keptStates.has(id));
    if (startYear === null || startYear > presentYear || attackers.length === 0 || defenders.length === 0) return [];
    return [{ type: "war" as const, id: `e-${e.i}`, name: e.name ?? "Guerre", startYear, endYear: yearOf(e.end), attackers, defenders }];
  });

  return {
    __v: 1,
    seed,
    presentYear,
    cultures,
    states,
    sites,
    links: [...links.values()].sort((x, y) => x.a.localeCompare(y.a) || x.b.localeCompare(y.b)),
    anchors,
  };
}
