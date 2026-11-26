import type { GameDate } from "../../calendar/types";
import type { TimelineEntry, TimelineScope } from "../../schemas/blocks/timeline";
import type { AbstractWorld } from "../world";
import type { Chronicle, HistoryEvent } from "./simulate";

/**
 * La chronique en entrées de frise (ADR 0048) : ce qui sera écrit sur la
 * fiche `world_timeline` d'un monde quand on figera son histoire.
 *
 * Toutes les entrées sont réservées au MJ : la toile de fond se découvre
 * (ADR 0104 §3, brouillard), elle ne s'affiche pas d'office aux personnes
 * qui jouent. Les identifiants sont stables, pour qu'une même chronique
 * réécrite ne double rien.
 */

/**
 * « de » ou « d' ». Contrairement à la frise (`worldTimeline.ts`), on n'élide
 * jamais devant un h : un nom généré (Hornver, Haldar) n'a pas de h muet connu,
 * et « de Hornver » reste correct là où « d'Hornver » sonne faux.
 */
function de(name: string): string {
  return /^[aeiouyàâäéèêëîïôöùûü]/i.test(name.trim()) ? `d'${name.trim()}` : `de ${name.trim()}`;
}

function ordinal(n: number): string {
  return n === 1 ? "1er" : `${n}e`;
}

function listNames(names: readonly string[]): string {
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} et ${names[names.length - 1]}`;
}

function yearDate(year: number, endYear: number | null = null): GameDate {
  return {
    year,
    month: null,
    day: null,
    precision: "year",
    end: endYear === null || endYear === year ? null : { year: endYear, month: null, day: null },
    label: null,
  };
}

export function chronicleToTimelineEntries(chronicle: Chronicle, world: AbstractWorld): TimelineEntry[] {
  const siteName = new Map(world.sites.map((s) => [s.id, s.name]));
  const site = new Map(world.sites.map((s) => [s.id, s]));
  const stateName = new Map(world.states.map((s) => [s.id, s.name]));
  const nameOf = (id: string) => stateName.get(id) ?? id;
  const visibility: TimelineEntry["visibility"] = { level: "gm", scopeId: null };

  const toEntry = (event: HistoryEvent): TimelineEntry => {
    if (event.kind === "founding") {
      const name = siteName.get(event.siteId) ?? event.siteId;
      const zone = site.get(event.siteId)?.settlement.zone;
      const scope: TimelineScope = event.isStateFounding ? "major" : zone === "bourg" ? "detail" : "notable";
      const title = event.isStateFounding && event.stateId
        ? `Fondation ${de(name)}, capitale ${de(nameOf(event.stateId))}`
        : `Fondation ${de(name)}`;
      return { id: `history:founding:${event.siteId}`, date: yearDate(event.year), kind: "founding", title, summary: "", visibility, scope };
    }
    if (event.kind === "war") {
      const sides = [...event.attackers, ...event.defenders];
      return {
        id: `history:war:${event.year}:${sides.join("+")}`,
        date: yearDate(event.year, event.endYear),
        kind: "war",
        title: event.name ?? `Guerre entre ${listNames(event.attackers.map(nameOf))} et ${listNames(event.defenders.map(nameOf))}`,
        summary: "",
        visibility,
        scope: "major",
      };
    }
    return {
      id: `history:ruler_death:${event.stateId}:${event.rulerOrdinal}`,
      date: yearDate(event.year),
      kind: "death",
      title: `Fin du ${ordinal(event.rulerOrdinal)} règne ${de(nameOf(event.stateId))}`,
      summary: "",
      visibility,
      scope: "notable",
    };
  };

  return chronicle.events.map(toEntry);
}
