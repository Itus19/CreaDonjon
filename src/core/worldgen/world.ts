import { z } from "zod";
import { zSettlementBlockData } from "../schemas/blocks/settlement";

/**
 * Le monde abstrait (specs/generation-du-monde.md §9.1) : ce que le
 * simulateur d'histoire reçoit, à la place d'une carte. Des villes avec leurs
 * agrégats, les liens qui les relient, des peuples, des États, et des
 * événements imposés par le présent.
 *
 * Chaque partie a son propre monde : rien ici ne suppose une carte
 * particulière. Le format est calqué sur l'export d'Azgaar (§8.1) pour que
 * l'import (ticket G-7) le remplisse sans détour, mais on peut aussi
 * l'écrire à la main (`history/mondeEssai.ts`).
 */

const zId = z.string().trim().min(1).max(64);

export const zWorldSite = z.object({
  id: zId,
  name: z.string().trim().min(1).max(120),
  /** État actuel de la ville ; `null` pour une ville libre. */
  stateId: zId.nullable(),
  cultureId: zId.nullable(),
  settlement: zSettlementBlockData,
});
export type WorldSite = z.infer<typeof zWorldSite>;

/** Les trois genres de routes d'Azgaar : route, sentier, route maritime. */
export const WORLD_LINK_KINDS = ["road", "trail", "sea"] as const;

export const zWorldLink = z.object({
  a: zId,
  b: zId,
  distanceKm: z.number().positive().max(100_000),
  kind: z.enum(WORLD_LINK_KINDS),
});
export type WorldLink = z.infer<typeof zWorldLink>;

export const zWorldCulture = z.object({ id: zId, name: z.string().trim().min(1).max(120) });

export const zWorldState = z.object({
  id: zId,
  name: z.string().trim().min(1).max(120),
  cultureId: zId.nullable(),
  /** La capitale d'aujourd'hui ; elle est fondée avant toute autre ville de l'État. */
  capitalSiteId: zId,
});
export type WorldState = z.infer<typeof zWorldState>;

/** Une guerre que le présent impose (les `pack.events` d'Azgaar) ; `endYear` absent = toujours en cours. */
export const zWorldWarAnchor = z.object({
  type: z.literal("war"),
  id: zId,
  name: z.string().trim().min(1).max(200),
  startYear: z.number().int(),
  endYear: z.number().int().nullable(),
  attackers: z.array(zId).min(1),
  defenders: z.array(zId).min(1),
});
export type WorldWarAnchor = z.infer<typeof zWorldWarAnchor>;

export const zAbstractWorld = z
  .object({
    __v: z.literal(1),
    /** Graine du monde : toute l'histoire en découle. */
    seed: z.number().int().min(0).max(0xffffffff),
    /** L'année où la chronique s'arrête et où la partie commence. */
    presentYear: z.number().int(),
    cultures: z.array(zWorldCulture).max(200),
    states: z.array(zWorldState).max(200),
    sites: z.array(zWorldSite).min(1).max(5_000),
    links: z.array(zWorldLink).max(20_000),
    anchors: z.array(zWorldWarAnchor).max(500).default([]),
  })
  .superRefine((world, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: "custom", message });
    const unique = (ids: readonly string[], what: string) => {
      if (new Set(ids).size !== ids.length) fail(`Deux ${what} portent le même identifiant`);
    };
    unique(world.sites.map((s) => s.id), "villes");
    unique(world.states.map((s) => s.id), "États");
    unique(world.cultures.map((c) => c.id), "peuples");
    unique(world.anchors.map((a) => a.id), "événements imposés");

    const sites = new Map(world.sites.map((s) => [s.id, s]));
    const states = new Set(world.states.map((s) => s.id));
    const cultures = new Set(world.cultures.map((c) => c.id));

    for (const site of world.sites) {
      if (site.stateId !== null && !states.has(site.stateId)) fail(`La ville ${site.id} appartient à un État inconnu`);
      if (site.cultureId !== null && !cultures.has(site.cultureId)) fail(`La ville ${site.id} a un peuple inconnu`);
    }
    for (const link of world.links) {
      if (!sites.has(link.a) || !sites.has(link.b)) fail(`Un lien relie une ville inconnue (${link.a} – ${link.b})`);
      if (link.a === link.b) fail(`Un lien relie la ville ${link.a} à elle-même`);
    }
    for (const state of world.states) {
      if (sites.get(state.capitalSiteId)?.stateId !== state.id) fail(`La capitale de ${state.id} n'est pas une de ses villes`);
      if (state.cultureId !== null && !cultures.has(state.cultureId)) fail(`L'État ${state.id} a un peuple inconnu`);
    }
    for (const anchor of world.anchors) {
      if (anchor.startYear > world.presentYear) fail(`La guerre ${anchor.id} commence après le présent`);
      if (anchor.endYear !== null && anchor.endYear < anchor.startYear) fail(`La guerre ${anchor.id} finit avant de commencer`);
      for (const s of [...anchor.attackers, ...anchor.defenders]) {
        if (!states.has(s)) fail(`La guerre ${anchor.id} nomme un État inconnu`);
      }
    }
  });
export type AbstractWorld = z.infer<typeof zAbstractWorld>;

/** Les États voisins : deux États sont voisins quand un lien relie une de leurs villes. Les villes libres n'en font pas. */
export function stateNeighbors(world: AbstractWorld): Map<string, Set<string>> {
  const stateOf = new Map(world.sites.map((s) => [s.id, s.stateId]));
  const neighbors = new Map<string, Set<string>>(world.states.map((s) => [s.id, new Set<string>()]));
  for (const link of world.links) {
    const a = stateOf.get(link.a) ?? null;
    const b = stateOf.get(link.b) ?? null;
    if (a === null || b === null || a === b) continue;
    neighbors.get(a)?.add(b);
    neighbors.get(b)?.add(a);
  }
  return neighbors;
}
