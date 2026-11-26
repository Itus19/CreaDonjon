import { infoboxValueText, type InfoboxEntry } from "../schemas/blocks/infobox";
import type { SettlementBlockData, SettlementWealth, SettlementZone } from "../schemas/blocks/settlement";
import { archetypeParCle } from "./archetypes";
import type { Occupant, OccupantPlaceType } from "./occupants";
import { deriveSeed } from "./seed";

/**
 * V3.2-31 — Ce qu'il faut au solo pour calculer qui est dans un lieu
 * (`specs/vie-du-monde.md` §3, §9, décision 2) :
 * - le type du lieu, lu dans son infobox ou son nom (« L'auberge du Chaudron ») ;
 * - la ville en agrégat : le bloc `settlement` s'il existe, sinon population,
 *   zone et richesse déduites des infobox du lieu et de ses parents ;
 * - pour chaque personne calculée, sa pièce et un libellé ;
 * - la différence entre deux heures : qui arrive, qui part.
 *
 * Module PUR.
 */

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

/** Mots qui désignent un type de lieu, du plus précis au plus vague (une « taverne-auberge » est une auberge). */
const PLACE_WORDS: readonly (readonly [OccupantPlaceType, readonly string[]])[] = [
  ["inn", ["auberge", "hostellerie", "hotellerie", "relais"]],
  ["tavern", ["taverne", "estaminet", "cabaret", "gargote", "bar"]],
  ["temple", ["temple", "chapelle", "sanctuaire", "eglise", "abbaye", "monastere"]],
  ["market", ["marche", "halle", "foire"]],
  ["barracks", ["caserne", "garnison", "corps de garde", "poste de garde"]],
  ["workshop", ["atelier", "forge", "echoppe", "boutique", "tannerie", "moulin"]],
  ["hermitage", ["ermitage", "cabane", "hutte"]],
];

function placeTypeIn(text: string): OccupantPlaceType | null {
  const words = ` ${normalize(text).replace(/[^a-z]+/g, " ")} `;
  for (const [type, list] of PLACE_WORDS) {
    if (list.some((w) => words.includes(` ${w} `))) return type;
  }
  return null;
}

/** Le type d'un lieu : l'entrée « Type » de son infobox d'abord, son nom sinon ; `null` si rien ne le dit (pas de présence calculée). */
export function placeTypeOf(name: string, entries: readonly InfoboxEntry[]): OccupantPlaceType | null {
  const typeEntry = entries.find((e) => normalize(e.label) === "type");
  return (typeEntry ? placeTypeIn(infoboxValueText(typeEntry.value)) : null) ?? placeTypeIn(name);
}

const ZONES: Record<string, SettlementZone> = { bourg: "bourg", village: "bourg", hameau: "bourg", ville: "ville", cite: "ville", capitale: "capitale" };
const WEALTHS: Record<string, SettlementWealth> = { modeste: "modeste", pauvre: "modeste", correcte: "correcte", moyenne: "correcte", reputee: "reputee", riche: "reputee", aisee: "reputee" };

/** Sans population lue : une population typique de la zone. */
const POPULATION_OF_ZONE: Record<SettlementZone, number> = { bourg: 800, ville: 8_000, capitale: 50_000 };

function zoneOfPopulation(population: number): SettlementZone {
  if (population < 2_000) return "bourg";
  if (population < 25_000) return "ville";
  return "capitale";
}

/** Une place du lieu ou de ses parents : son id, ses entrées d'infobox, son bloc `settlement` s'il en a un. */
export interface PlaceFacts {
  id: string;
  entries: readonly InfoboxEntry[];
  settlement?: SettlementBlockData | null;
}

function firstEntry(chain: readonly PlaceFacts[], label: string): { value: string; id: string } | null {
  for (const place of chain) {
    const entry = place.entries.find((e) => normalize(e.label) === label);
    if (entry) return { value: infoboxValueText(entry.value), id: place.id };
  }
  return null;
}

/**
 * La ville en agrégat d'un lieu (`chain` : le lieu puis ses parents
 * `part_of`, du plus proche au plus lointain). Le bloc `settlement` le plus
 * proche l'emporte. Sinon, on lit « Population », « Zone » et « Richesse »
 * dans les infobox, l'une déduisant l'autre quand elle manque ; sans rien,
 * un bourg de richesse correcte. La graine vient de l'id de la place qui
 * porte la ville : deux auberges de la même ville partagent sa graine.
 */
export function settlementOf(chain: readonly PlaceFacts[]): SettlementBlockData | null {
  if (chain.length === 0) return null;
  const withBlock = chain.find((p) => p.settlement);
  if (withBlock?.settlement) return withBlock.settlement;

  const populationEntry = firstEntry(chain, "population");
  const digits = populationEntry?.value.replace(/[^0-9]/g, "") ?? "";
  const readPopulation = digits === "" ? null : Math.min(Number(digits), 10_000_000);
  const zoneEntry = firstEntry(chain, "zone");
  const readZone = zoneEntry ? (ZONES[normalize(zoneEntry.value)] ?? null) : null;
  const wealthEntry = firstEntry(chain, "richesse");
  const wealth = wealthEntry ? (WEALTHS[normalize(wealthEntry.value)] ?? "correcte") : "correcte";

  const zone = readZone ?? (readPopulation !== null ? zoneOfPopulation(readPopulation) : "bourg");
  const population = readPopulation ?? POPULATION_OF_ZONE[zone];
  const cityId = populationEntry?.id ?? zoneEntry?.id ?? chain[chain.length - 1].id;
  return { __v: 1, seed: deriveSeed(0, cityId), population, zone, wealth, biome: "temperate_deciduous_forest", peoples: [], trades: [] };
}

/** L'identifiant d'une personne calculée dans la scène : son entité du wiki, ou sa graine. */
export function occupantId(o: Pick<Occupant, "seed" | "entityId">): string {
  return o.entityId ?? `calc-${o.seed}`;
}

/**
 * Sa pièce dans le lieu (V3.2-28) : chez soi, on est dans une pièce à soi
 * (la chambre d'un logé, les quartiers du personnel) ; sinon dans l'espace
 * principal, au comptoir ou dans la salle.
 */
export function occupantRoom(o: Pick<Occupant, "role" | "rank">, at: string | null): string | null {
  if (at !== "home") return null;
  return o.role === "lodger" ? `chambre ${o.rank + 1}` : "les quartiers du personnel";
}

const TRADE_LABELS: Record<string, string> = {
  innkeeper: "aubergiste",
  tavern_keeper: "tenancier·ère",
  inn_staff: "serveur·euse",
  priest: "prêtre·sse",
  acolyte: "acolyte",
  merchant: "marchand·e",
  sergeant: "sergent·e",
  guard: "garde",
  artisan: "artisan·e",
  apprentice: "apprenti·e",
  hermit: "ermite",
};

const AGE_LABELS: Record<Occupant["ageBand"], string> = { young: "jeune", adult: "d'âge mûr", elder: "âgé·e" };

/**
 * Un libellé sans nom (« aubergiste, d'âge mûr », « habitué·e, pilier de
 * bar, jeune ») : une personne calculée n'a pas de nom tant qu'on n'a pas
 * interagi avec elle (§3). Le nom viendra du générateur, jamais de l'IA.
 */
export function occupantLabel(o: Pick<Occupant, "role" | "trade" | "archetype" | "ageBand">): string {
  const archetype = archetypeParCle(o.archetype)?.label.toLowerCase() ?? o.archetype;
  const who =
    o.role === "head" || o.role === "staff"
      ? (TRADE_LABELS[o.trade ?? ""] ?? archetype)
      : o.role === "regular"
        ? `habitué·e, ${archetype}`
        : o.role === "lodger"
          ? "client·e d'une chambre"
          : o.role === "passing"
            ? `de passage, ${archetype}`
            : "client·e de passage";
  return `${who}, ${AGE_LABELS[o.ageBand]}`;
}

/** Qui est arrivé, qui est parti, entre deux listes d'identifiants (dans l'ordre de la liste d'après, puis d'avant). */
export function presenceDiff(before: readonly string[], after: readonly string[]): { arrived: string[]; left: string[] } {
  const was = new Set(before);
  const is = new Set(after);
  return { arrived: after.filter((id) => !was.has(id)), left: before.filter((id) => !is.has(id)) };
}
