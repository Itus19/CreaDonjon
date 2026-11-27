import type { WorldExport } from "../../schemas/worldExport";
import { simulateHistory } from "../history/simulate";
import { worldToExport } from "../toWorldExport";
import { azgaarToAbstractWorld, zAzgaarExport } from "./import";

/** Ce que l'écran d'import annonce avant de créer le monde. */
export interface AzgaarWorldSummary {
  name: string;
  sites: number;
  /** Les villes qui ont leur page dès la création ; les autres naissent à la découverte. */
  notables: number;
  states: number;
  events: number;
  presentYear: number;
}

const DEFAULT_YEARS = 300;
const MAX_YEARS = 2000;
/** Marge avant la plus vieille guerre d'Azgaar, pour que ses États aient le temps de naître. */
const MARGIN_YEARS = 20;

/** La durée simulée : 300 ans, ou assez pour couvrir la plus vieille guerre de la carte (la simulation écarte une ancre plus ancienne que son début). */
export function historyYears(presentYear: number, anchorStartYears: readonly number[]): number {
  const oldest = anchorStartYears.length === 0 ? presentYear : Math.min(...anchorStartYears);
  return Math.min(MAX_YEARS, Math.max(DEFAULT_YEARS, presentYear - oldest + MARGIN_YEARS));
}

/**
 * G-7b — un fichier d'Azgaar (export « Complet ») devenu un monde importable :
 * lecture (§8.0), histoire couche 1 (§9.2 bis), puis format d'export de monde.
 * Pur : il tourne dans le navigateur (ADR 0109, G3), jamais dans une route.
 * La graine vient de la carte, donc la même carte donne le même monde.
 */
export function azgaarFileToWorldExport(json: unknown): { data: WorldExport; summary: AzgaarWorldSummary } {
  const parsed = zAzgaarExport.safeParse(json);
  if (!parsed.success) throw new Error("Ce fichier n'est pas une carte Azgaar lisible : exportez-la au format JSON « Complet ».");
  const world = azgaarToAbstractWorld(parsed.data);
  const chronicle = simulateHistory(world, { years: historyYears(world.presentYear, world.anchors.map((a) => a.startYear)) });
  const name = parsed.data.info.mapName?.trim() || "Monde Azgaar";
  return {
    data: worldToExport(world, { name, chronicle }),
    summary: { name, sites: world.sites.length, notables: world.sites.filter((s) => s.notable).length, states: world.states.length, events: chronicle.events.length, presentYear: world.presentYear },
  };
}
